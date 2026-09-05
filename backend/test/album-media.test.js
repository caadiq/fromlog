import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import photosRoutes from '../src/routes/albums/photos.js';
import teasersRoutes from '../src/routes/albums/teasers.js';
import { buildMediaPlan, checkEntry } from '../scripts/lib/album-media-plan.mjs';

const base = 'https://media.test/bucket';
const uuid = /^[0-9a-f-]{36}\.(webp|mp4)$/;
const oldRow = (id = 1) => ({
  id, album_id: 1, sort_order: id, photo_type: 'solo', concept_name: 'Concept',
  original_url: `${base}/album/album/photo/original/03.webp`,
  medium_url: `${base}/album/album/photo/medium_800/03.webp`,
  thumb_url: `${base}/album/album/photo/thumb_400/03.webp`,
});
const snapshot = (photos = [oldRow()], teasers = []) => ({
  albums: [{ id: 1, folder_name: 'album' }], album_photos: photos,
  album_teasers: teasers, album_photo_members: [{ id: 1, photo_id: 1, member_id: 1 }],
});

test('migration maps all sizes to one UUID and leaves metadata untouched', () => {
  const original = snapshot();
  const backup = structuredClone(original);
  const plan = buildMediaPlan(original, base);
  assert.deepEqual(original, backup);
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.objects.length, 3);
  const filenames = new Set(Object.values(plan.entries[0].after).map(url => url.split('/').pop()));
  assert.equal(filenames.size, 1);
  assert.match([...filenames][0], uuid);
  assert.deepEqual(plan.entries[0].before, {
    original_url: original.album_photos[0].original_url,
    medium_url: original.album_photos[0].medium_url,
    thumb_url: original.album_photos[0].thumb_url,
  });
});

test('shared legacy files receive independent identities per DB row', () => {
  const plan = buildMediaPlan(snapshot([oldRow(1), oldRow(2)]), base);
  assert.notEqual(plan.entries[0].after.original_url, plan.entries[1].after.original_url);
  assert.equal(new Set(plan.objects.map(o => o.targetKey)).size, 6);
});

test('video teasers preserve both poster variants and the video under one UUID', () => {
  const row = { ...oldRow(), media_type: 'video', video_url: `${base}/album/album/teaser/video/01.mp4` };
  const plan = buildMediaPlan(snapshot([], [row]), base);
  assert.equal(plan.objects.length, 4);
  const after = plan.entries[0].after;
  assert(after.original_url.includes('/teaser/original/'));
  assert(after.video_url.includes('/teaser/video/'));
  assert.equal(after.original_url.split('/').pop().split('.')[0], after.video_url.split('/').pop().split('.')[0]);
});

test('video URL aliases are copied once and remain identical', () => {
  const url = `${base}/album/album/teaser/video/01.mp4`;
  const row = { id: 1, album_id: 1, original_url: url, medium_url: url, thumb_url: url, video_url: url };
  const plan = buildMediaPlan(snapshot([], [row]), base);
  assert.equal(plan.objects.length, 1);
  assert.equal(new Set(Object.values(plan.entries[0].after)).size, 1);
});

test('a second plan skips migrated UUID media', () => {
  const original = snapshot();
  const first = buildMediaPlan(original, base);
  original.album_photos[0] = { ...original.album_photos[0], ...first.entries[0].after };
  assert.equal(buildMediaPlan(original, base).entries.length, 0);
});

test('foreign storage URLs fail before copying or replacing URLs', () => {
  const original = snapshot();
  original.album_photos[0].original_url = 'https://other.test/private.webp';
  assert.throws(() => buildMediaPlan(original, base), /Unexpected media URL/);
});

test('apply and rollback are idempotent and reject intervening URL changes', () => {
  const original = oldRow();
  const entry = buildMediaPlan(snapshot(), base).entries[0];
  const migrated = { ...original, ...entry.after };
  assert.equal(checkEntry(original, entry, 'apply'), true);
  assert.equal(checkEntry(migrated, entry, 'apply'), false);
  assert.equal(checkEntry(migrated, entry, 'rollback'), true);
  assert.equal(checkEntry(original, entry, 'rollback'), false);
  assert.throws(() => checkEntry({ ...original, original_url: 'changed' }, entry, 'apply'), /changed since planning/);
  assert.throws(() => checkEntry(null, entry, 'apply'), /Missing\/moved/);
});

const objects = new Map();
let originalSend;
before(() => {
  originalSend = S3Client.prototype.send;
  S3Client.prototype.send = async function (command) {
    if (command.constructor.name === 'PutObjectCommand') objects.set(command.input.Key, command.input.Body);
    else if (command.constructor.name === 'DeleteObjectCommand') objects.delete(command.input.Key);
    else throw new Error('Unexpected S3 command');
    return {};
  };
});
after(() => { S3Client.prototype.send = originalSend; });

// Use original routes and image conversion, replacing only persistence/network I/O.
async function harness() {
  const photos = [], teasers = [], routes = new Map();
  let nextId = 1;
  const db = {
    async query(sql, values = []) {
      if (sql.startsWith('SELECT folder_name')) return [[{ folder_name: 'album' }]];
      if (sql.includes('MAX(sort_order)')) {
        const rows = sql.includes('album_teasers') ? teasers : photos;
        return [[{ maxOrder: Math.max(0, ...rows.map(r => r.sort_order)) }]];
      }
      if (sql.includes('INSERT INTO album_photos')) {
        const [album_id, original_url, medium_url, thumb_url, photo_type, concept_name, sort_order] = values;
        const id = nextId++;
        photos.push({ id, album_id, original_url, medium_url, thumb_url, photo_type, concept_name, sort_order });
        return [{ insertId: id }];
      }
      if (sql.includes('INSERT INTO album_teasers')) {
        const [album_id, original_url, medium_url, thumb_url, video_url, sort_order, media_type] = values;
        const id = nextId++;
        teasers.push({ id, album_id, original_url, medium_url, thumb_url, video_url, sort_order, media_type });
        return [{ insertId: id }];
      }
      if (sql.includes('SELECT p.*') || sql.includes('SELECT t.*')) {
        const list = sql.includes('SELECT p.*') ? photos : teasers;
        return [list.filter(r => r.id === values[0]).map(r => ({ ...r, folder_name: 'album' }))];
      }
      if (sql.startsWith('DELETE FROM album_photos') || sql.startsWith('DELETE FROM album_teasers')) {
        const list = sql.includes('album_photos') ? photos : teasers;
        list.splice(list.findIndex(r => r.id === values[0]), 1);
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('DELETE FROM album_photo_members') || sql.startsWith('INSERT INTO logs')) return [{}];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async getConnection() { return { query: db.query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; },
  };
  const app = { db, redis: { del: async () => {}, scan: async () => ['0', []] }, log: { error: message => { throw new Error(message); } }, authenticate: async () => {} };
  for (const method of ['get', 'post', 'put', 'delete']) app[method] = (route, opts, handler) => routes.set(`${method} ${route}`, handler);
  await photosRoutes(app);
  await teasersRoutes(app);
  const reply = () => ({ raw: { writeHead() {}, write() {}, end() {} }, code() { return this; }, send(value) { return value; } });
  async function upload(type = 'concept', start = 1, video = false) {
    const buffer = video ? Buffer.from('test-video') : await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer();
    await routes.get('post /:albumId/photos')({ params: { albumId: 1 }, async *parts() {
      yield { type: 'field', fieldname: 'photoType', value: type };
      if (start !== null) yield { type: 'field', fieldname: 'startNumber', value: String(start) };
      yield { type: 'file', fieldname: 'photos', mimetype: video ? 'video/mp4' : 'image/png', toBuffer: async () => buffer };
    } }, reply());
  }
  return { photos, teasers, upload, async remove(id, teaser = false) {
    const route = teaser ? 'delete /:albumId/teasers/:teaserId' : 'delete /:albumId/photos/:photoId';
    return routes.get(route)({ params: { albumId: 1, photoId: id, teaserId: id } }, reply());
  } };
}

test('uploading at reused display numbers preserves old media; deletion affects only its own files', async () => {
  objects.clear();
  const h = await harness();
  await h.upload('concept', 1);
  await h.upload('concept', 2);
  await h.upload('concept', 3);
  await h.remove(h.photos[1].id);
  h.photos[1].sort_order = 2;
  const retained = new Map(objects);
  await h.upload('concept', 3);
  assert.equal(new Set(h.photos.map(p => p.original_url)).size, 3);
  for (const [key, body] of retained) assert.deepEqual(objects.get(key), body);
  for (const row of h.photos) assert.match(row.original_url.split('/').pop(), uuid);
  await h.remove(h.photos[2].id);
  assert.deepEqual(objects, retained);
});

test('teaser images and videos get independent UUIDs even at the same display number', async () => {
  objects.clear();
  const h = await harness();
  await h.upload('teaser', 1);
  await h.upload('teaser', 1, true);
  assert.notEqual(h.teasers[0].original_url, h.teasers[1].video_url);
  assert.match(h.teasers[1].video_url.split('/').pop(), uuid);
  assert.equal(objects.size, 4);
  await h.remove(h.teasers[1].id, true);
  assert.equal(objects.size, 3);
  await h.remove(h.teasers[0].id, true);
  assert.equal(objects.size, 0);
});

test('automatic teaser display order starts after existing teasers', async () => {
  const h = await harness();
  await h.upload('concept', 50);
  await h.upload('teaser', 2);
  await h.upload('teaser', null);
  assert.equal(h.teasers[1].sort_order, 3);
});
