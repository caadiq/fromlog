import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import mysql from 'mysql2/promise';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import pendingRoutes from '../src/routes/admin/pending.js';
import { createEtcSchedule, createEventSchedule, createVarietySchedule } from '../src/services/event.js';
import { createTempYoutubeSchedule } from '../src/utils/tempSchedule.js';

// Never inherit application DB credentials: this database must be disposable.
if (!process.env.PENDING_TEST_HOST) throw new Error('Set PENDING_TEST_HOST to an isolated MariaDB with fromlog_test_pending.');
const db = mysql.createPool({ host: process.env.PENDING_TEST_HOST, user: 'root', password: process.env.PENDING_TEST_PASSWORD || '', database: 'fromlog_test_pending', connectionLimit: 6 });
let api, png, originalSend;
let uploads, failUpload;
const search = { index: () => ({ addDocuments: async () => {} }) };

before(async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS schedules (id INT AUTO_INCREMENT PRIMARY KEY, category_id INT, title VARCHAR(500) NOT NULL, date DATE NOT NULL, time TIME, is_temp TINYINT DEFAULT 0) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS schedule_categories (id INT PRIMARY KEY, name VARCHAR(100), color VARCHAR(20)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS schedule_x (schedule_id INT PRIMARY KEY, username VARCHAR(100)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS event_venues (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(200), address TEXT, road_address TEXT, lat DOUBLE, lng DOUBLE, kakao_id VARCHAR(100)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS schedule_etc (schedule_id INT PRIMARY KEY, venue_id INT, description TEXT, post_urls JSON, poster_image_ids JSON, FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS schedule_event (schedule_id INT PRIMARY KEY, subtype VARCHAR(30) NOT NULL, school_name VARCHAR(100), venue_id INT, post_urls JSON, poster_image_ids JSON, FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS schedule_variety (schedule_id INT PRIMARY KEY, broadcaster VARCHAR(100) NOT NULL, description TEXT, replay_url VARCHAR(500), FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS schedule_youtube (id INT AUTO_INCREMENT PRIMARY KEY, schedule_id INT NOT NULL UNIQUE, video_id VARCHAR(20) UNIQUE, video_type ENUM('video','shorts') NOT NULL DEFAULT 'video', channel_id VARCHAR(30), channel_name VARCHAR(100), FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS images (id INT AUTO_INCREMENT PRIMARY KEY, original_url VARCHAR(500) NOT NULL, medium_url VARCHAR(500), thumb_url VARCHAR(500)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS bot_pending_schedules (id INT PRIMARY KEY, source VARCHAR(20) DEFAULT 'dc', source_ref VARCHAR(100), category_name VARCHAR(30) NOT NULL, title VARCHAR(500) NOT NULL, date DATE, time TIME, members JSON, venue_name VARCHAR(200), description TEXT, dup_hint VARCHAR(255), stale_at TIMESTAMP NULL, status ENUM('pending','registered','dismissed') NOT NULL DEFAULT 'pending', created_schedule_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMP NULL) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS logs (id INT AUTO_INCREMENT PRIMARY KEY, actor VARCHAR(100), action VARCHAR(100), category VARCHAR(100), target_type VARCHAR(100), target_id INT, summary TEXT, details JSON) ENGINE=InnoDB`,
  ];
  for (const sql of statements) await db.query(sql);
  png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#336699' } }).png().toBuffer();
  originalSend = S3Client.prototype.send;
  S3Client.prototype.send = async function(command) {
    assert.equal(command.constructor.name, 'PutObjectCommand');
    uploads.push(command.input.Key);
    if (failUpload) throw new Error('Simulated S3 outage');
    return {};
  };
  api = Fastify();
  api.decorate('db', db);
  api.decorate('redis', null);
  api.decorate('meilisearch', search);
  api.decorate('authenticate', async () => {});
  await api.register(multipart);
  await api.register(pendingRoutes);
  await api.ready();
});

beforeEach(async () => {
  uploads = []; failUpload = false;
  for (const trigger of ['fail_link', 'fail_completion']) await db.query(`DROP TRIGGER IF EXISTS ${trigger}`);
  for (const table of ['bot_pending_schedules', 'schedules', 'images', 'event_venues', 'logs']) await db.query(`DELETE FROM ${table}`);
  await db.query("INSERT INTO bot_pending_schedules (id, category_name, title, date) VALUES (1, '기타', '큐 등록 테스트', '2026-09-06')");
});
after(async () => { S3Client.prototype.send = originalSend; await api?.close(); await db.end(); });

function register(payload = {}, posters = [], id = 1) {
  const boundary = 'pending-test-boundary';
  const parts = [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(payload)}\r\n`)];
  for (const [index, buffer] of posters.entries()) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="poster"; filename="${index}.png"\r\nContent-Type: image/png\r\n\r\n`), buffer, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return api.inject({ method: 'POST', url: `/${id}/register`, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) });
}
async function count(table) { const [[row]] = await db.query('SELECT COUNT(*) n FROM ??', [table]); return row.n; }
async function queue() { const [[row]] = await db.query('SELECT * FROM bot_pending_schedules WHERE id = 1'); return row; }
async function expectOneSchedule(response) {
  assert([200, 201].includes(response.statusCode), response.body);
  assert.equal(await count('schedules'), 1);
  assert.equal((await queue()).created_schedule_id, response.json().id);
  assert.equal((await queue()).status, 'registered');
}

for (const category of ['기타', '행사']) {
  test(`${category}: corrupt poster leaves a durable link and retries only the poster`, async () => {
    const failed = await register({ category, title: '처음 저장한 제목' }, [Buffer.from('broken')]);
    assert.equal(failed.statusCode, 500);
    const linkedId = failed.json().createdScheduleId;
    assert.equal((await queue()).created_schedule_id, linkedId);
    assert.equal((await queue()).status, 'pending');
    assert.equal(await count('schedules'), 1);
    const retried = await register({ category, title: '재시도에서 덮어쓰지 않을 제목' }, [png]);
    await expectOneSchedule(retried);
    assert.equal(retried.json().id, linkedId);
    const [[schedule]] = await db.query('SELECT title FROM schedules WHERE id = ?', [linkedId]);
    assert.equal(schedule.title, '처음 저장한 제목');
    assert.equal(await count('images'), 1);
    const doneAgain = await register({ category }, [png]);
    await expectOneSchedule(doneAgain);
    assert.equal(doneAgain.statusCode, 200);
    assert.equal(uploads.length, 3);
  });
}

test('partial image processing rolls back all image rows; retry without posters completes the existing schedule', async () => {
  const failed = await register({}, [png, Buffer.from('broken')]);
  assert.equal(failed.statusCode, 500);
  assert.equal(await count('images'), 0);
  await expectOneSchedule(await register());
  assert.equal(await count('images'), 0);
});

test('S3 outage retries the same schedule', async () => {
  failUpload = true;
  assert.equal((await register({}, [png])).statusCode, 500);
  const linked = (await queue()).created_schedule_id;
  failUpload = false;
  const response = await register({}, [png]);
  await expectOneSchedule(response);
  assert.equal(response.json().id, linked);
});

test('schedule creation rolls back if the queue link cannot be saved', async () => {
  await db.query("CREATE TRIGGER fail_link BEFORE UPDATE ON bot_pending_schedules FOR EACH ROW BEGIN IF NEW.created_schedule_id IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'link failed'; END IF; END");
  assert.equal((await register()).statusCode, 500);
  assert.equal(await count('schedules'), 0);
  assert.equal((await queue()).created_schedule_id, null);
  await db.query('DROP TRIGGER fail_link');
  await expectOneSchedule(await register());
});

test('completion failure rolls back poster attachment but preserves the schedule link', async () => {
  await db.query("CREATE TRIGGER fail_completion BEFORE UPDATE ON bot_pending_schedules FOR EACH ROW BEGIN IF NEW.status = 'registered' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'completion failed'; END IF; END");
  assert.equal((await register({}, [png])).statusCode, 500);
  const linked = (await queue()).created_schedule_id;
  assert.equal(await count('images'), 0);
  const [[details]] = await db.query('SELECT poster_image_ids FROM schedule_etc WHERE schedule_id = ?', [linked]);
  assert.equal(details.poster_image_ids, null);
  await db.query('DROP TRIGGER fail_completion');
  const response = await register({}, [png]);
  await expectOneSchedule(response);
  assert.equal(response.json().id, linked);
  assert.equal(await count('images'), 1);
});

test('concurrent registrations return one schedule and upload one poster set', async () => {
  const responses = await Promise.all([register({}, [png]), register({}, [png]), register({}, [png])]);
  for (const response of responses) await expectOneSchedule(response);
  assert.equal(new Set(responses.map(r => r.json().id)).size, 1);
  assert.equal(responses.filter(r => r.statusCode === 201).length, 1);
  assert.equal(await count('images'), 1);
  assert.equal(uploads.length, 3);
});

test('dismiss cannot discard a linked or completed registration', async () => {
  assert.equal((await register({}, [Buffer.from('broken')])).statusCode, 500);
  assert.equal((await api.inject({ method: 'POST', url: '/1/dismiss' })).statusCode, 409);
  await expectOneSchedule(await register());
  assert.equal((await api.inject({ method: 'POST', url: '/1/dismiss' })).statusCode, 409);
  assert.equal((await queue()).status, 'registered');
});

test('concurrent dismissal and registration cannot both succeed', async () => {
  const [registration, dismissal] = await Promise.all([register({}, [png]), api.inject({ method: 'POST', url: '/1/dismiss' })]);
  assert([200, 409].includes(dismissal.statusCode), dismissal.body);
  if (dismissal.statusCode === 200) {
    assert.equal(registration.statusCode, 409);
    assert.equal(await count('schedules'), 0);
    assert.equal((await queue()).status, 'dismissed');
  } else await expectOneSchedule(registration);
});

test('deleted linked schedule produces a conflict instead of a replacement', async () => {
  await register({}, [Buffer.from('broken')]);
  await db.query('DELETE FROM schedules');
  assert.equal((await register()).statusCode, 409);
  assert.equal(await count('schedules'), 0);
});

for (const category of ['유튜브', '예능']) {
  test(`${category}: creation is linked atomically and completed replay is idempotent`, async () => {
    const payload = { category, broadcaster: 'KBS', replayUrl: 'https://example.test/replay' };
    const response = await register(payload);
    await expectOneSchedule(response);
    await expectOneSchedule(await register());
    const table = category === '유튜브' ? 'schedule_youtube' : 'schedule_variety';
    assert.equal(await count(table), 1);
    if (category === '유튜브') {
      const [[schedule]] = await db.query('SELECT is_temp FROM schedules WHERE id = ?', [response.json().id]);
      assert.equal(schedule.is_temp, 1);
    }
  });
}

test('invalid input or a missing queue item creates no schedule', async () => {
  assert.equal((await register({ title: '' })).statusCode, 400);
  assert.equal((await register({ category: '콘서트' })).statusCode, 400);
  assert.equal((await register({ category: '예능' })).statusCode, 400);
  assert.equal((await register({}, [], 999)).statusCode, 404);
  assert.equal(await count('schedules'), 0);
});

test('retry preserves separately attached posters and uses the saved schedule category', async () => {
  await register({ category: '행사' }, [Buffer.from('broken')]);
  const id = (await queue()).created_schedule_id;
  const [image] = await db.query("INSERT INTO images (original_url) VALUES ('https://example.test/existing.webp')");
  await db.query('UPDATE schedule_event SET poster_image_ids = ? WHERE schedule_id = ?', [JSON.stringify([image.insertId]), id]);
  await expectOneSchedule(await register({ category: '기타' }, [png]));
  const [[details]] = await db.query('SELECT poster_image_ids FROM schedule_event WHERE schedule_id = ?', [id]);
  const ids = JSON.parse(details.poster_image_ids);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], image.insertId);
  assert(uploads.every(key => key.startsWith(`event/${id}/poster/`)));
});

test('existing standalone creation services still commit their schedule details', async () => {
  const data = { title: '직접 생성', date: '2026-09-06', time: '18:00', broadcaster: 'KBS', subtype: 'general', schoolName: null, description: '설명' };
  for (const create of [createEtcSchedule, createEventSchedule, createVarietySchedule, createTempYoutubeSchedule]) {
    const id = await create(db, search, data);
    const [[row]] = await db.query('SELECT title FROM schedules WHERE id = ?', [id]);
    assert.equal(row.title, data.title);
  }
  assert.equal(await count('schedules'), 4);
  for (const table of ['schedule_etc', 'schedule_event', 'schedule_variety', 'schedule_youtube']) assert.equal(await count(table), 1);
});
