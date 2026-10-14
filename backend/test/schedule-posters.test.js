import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { Readable } from 'node:stream';
import mysql from 'mysql2/promise';
import Fastify from 'fastify';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import config from '../src/config/index.js';
import posterRoutes from '../src/routes/admin/schedule-posters.js';
import { readSchedulePoster } from '../src/services/schedulePosters.js';

if (!process.env.POSTER_TEST_HOST) throw new Error('POSTER_TEST_HOST must point to an isolated MariaDB.');
const db = mysql.createPool({ host: process.env.POSTER_TEST_HOST, user: 'root', password: '', database: 'fromlog_test_posters' });
let api, png, originalSend, objectMode = 'ok', requests = 0;
const prefix = `${config.s3.publicUrl.replace(/\/$/, '')}/${config.s3.bucket}/`;
before(async () => {
  for (const sql of [
    'CREATE TABLE schedules (id INT PRIMARY KEY, title VARCHAR(500), date DATE)',
    'CREATE TABLE images (id INT PRIMARY KEY, original_url VARCHAR(500), medium_url VARCHAR(500), thumb_url VARCHAR(500))',
    'CREATE TABLE schedule_variety (schedule_id INT, thumbnail_id INT)',
    'CREATE TABLE schedule_event (schedule_id INT, poster_image_ids JSON)',
    'CREATE TABLE schedule_etc (schedule_id INT, poster_image_ids JSON)',
    'CREATE TABLE schedule_concert (schedule_id INT, series_id INT)',
    'CREATE TABLE concert_series (id INT, poster_id INT)',
    'CREATE TABLE logs (actor VARCHAR(100), action VARCHAR(100), category VARCHAR(100), target_type VARCHAR(100), target_id INT, summary TEXT, details JSON)',
  ]) await db.query(sql);
  await db.query("INSERT INTO schedules VALUES (1, '계약결혼 1회', '2026-09-28'), (2, '계약결혼 2회', '2026-10-05'), (3, '별도 행사', '2026-10-06'), (4, '기타 100%_!', '2026-10-07'), (5, '콘서트', '2026-10-08'), (6, '이미지 없는 일정', '2026-10-09')");
  for (let id = 1; id <= 7; id++) await db.query('INSERT INTO images VALUES (?, ?, ?, ?)', [id, `${prefix}schedule/${id}/poster.png`, `${prefix}${id}-medium.png`, `${prefix}${id}-thumb.png`]);
  await db.query('INSERT INTO schedule_variety VALUES (1,1), (2,2), (6,NULL)');
  await db.query("INSERT INTO schedule_event VALUES (3,'[3,4]')");
  await db.query("INSERT INTO schedule_etc VALUES (4,'[5]')");
  await db.query('INSERT INTO schedule_concert VALUES (5,1)');
  await db.query('INSERT INTO concert_series VALUES (1,6)');
  png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#336699' } }).png().toBuffer();
  originalSend = S3Client.prototype.send;
  S3Client.prototype.send = async function(command) {
    requests++;
    assert.equal(command.constructor.name, 'GetObjectCommand');
    assert.equal(command.input.Bucket, config.s3.bucket);
    if (objectMode === 'fail') throw new Error('Storage unavailable');
    return { ContentLength: objectMode === 'large' ? 11 * 1024 * 1024 : undefined,
      Body: Readable.from([objectMode === 'streamLarge' ? Buffer.alloc(11 * 1024 * 1024) : png]) };
  };
  api = Fastify(); api.decorate('db', db);
  api.decorate('authenticate', async (req, reply) => { if (req.headers.authorization !== 'Bearer test') return reply.code(401).send({ error: 'Unauthorized' }); });
  await api.register(posterRoutes, { prefix: '/posters' }); await api.ready();
});
after(async () => { S3Client.prototype.send = originalSend; await api?.close(); await db.end(); });
const get = q => api.inject({ method: 'GET', url: `/posters/?${q}`, headers: { authorization: 'Bearer test' } });
const load = (scheduleId, imageId) => api.inject({ method: 'POST', url: '/posters/import', headers: { authorization: 'Bearer test' }, payload: { scheduleId, imageId } });

test('both routes require authentication', async () => {
  assert.equal((await api.inject('/posters/')).statusCode, 401);
  assert.equal((await api.inject({ method: 'POST', url: '/posters/import', payload: { scheduleId: 1, imageId: 1 } })).statusCode, 401);
});
test('title search returns previous episodes newest first and preview only', async () => {
  const res = await get(`q=${encodeURIComponent('계약결혼')}`);
  assert.equal(res.statusCode, 200); assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(res.json().items.map(item => item.scheduleId), [2, 1]);
  assert.equal(res.json().items[0].date, '2026-10-05');
  assert.equal(res.json().items[0].dataUrl, undefined);
});
test('all four sources and multiple event images are available; orphan images excluded', async () => {
  assert.deepEqual((await get('')).json().items.map(item => item.imageId), [6, 5, 3, 4, 2, 1]);
});
test('LIKE wildcards are treated as literal input', async () => {
  assert.deepEqual((await get(`q=${encodeURIComponent('%_!')}`)).json().items.map(item => item.scheduleId), [4]);
  assert.equal((await get(`q=${encodeURIComponent("' OR 1=1 --")}`)).json().items.length, 0);
});
test('selected image is returned with correct bytes and MIME, without new DB records', async () => {
  const res = await load(1, 1);
  assert.equal(res.statusCode, 200); assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.json().dataUrl, `data:image/png;base64,${png.toString('base64')}`);
  assert.equal(res.json().name, 'schedule-1-1.png');
  const [[row]] = await db.query('SELECT COUNT(*) AS count FROM images'); assert.equal(row.count, 7);
});
test('orphan or mismatched schedule/image pairs are rejected before reading storage', async () => {
  const before = requests;
  assert.equal((await load(1, 2)).statusCode, 404); assert.equal((await load(1, 7)).statusCode, 404);
  assert.equal(requests, before);
});
test('invalid IDs and pagination are rejected', async () => {
  assert.equal((await load(-1, 1)).statusCode, 400); assert.equal((await load(1, 'anything')).statusCode, 400);
  assert.equal((await get('offset=-1')).statusCode, 400); assert.equal((await get('offset=100001')).statusCode, 400);
});
test('storage outage returns recoverable error and retry succeeds', async () => {
  objectMode = 'fail'; assert.equal((await load(1, 1)).statusCode, 502);
  objectMode = 'ok'; assert.equal((await load(1, 1)).statusCode, 200);
});
test('external URLs and oversized bodies cannot be imported', async () => {
  const before = requests;
  await assert.rejects(() => readSchedulePoster('http://127.0.0.1/private'));
  assert.equal(requests, before);
  for (const mode of ['large', 'streamLarge']) {
    objectMode = mode; assert.equal((await load(1, 1)).statusCode, 502);
  }
  objectMode = 'ok';
});
test('pagination returns 30 images and a continuation flag', async () => {
  for (let id = 10; id < 45; id++) {
    await db.query("INSERT INTO schedules VALUES (?, '페이지 테스트', '2026-10-10')", [id]);
    await db.query('INSERT INTO schedule_variety VALUES (?,1)', [id]);
  }
  const first = (await get(`q=${encodeURIComponent('페이지')}`)).json();
  const second = (await get(`q=${encodeURIComponent('페이지')}&offset=30`)).json();
  assert.equal(first.items.length, 30); assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 5); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.scheduleId)).size, 35);
});
