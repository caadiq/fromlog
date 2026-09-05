import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { updateAlbum } from '../src/services/album.js';
import albumsRoutes from '../src/routes/albums/index.js';

// Use only a disposable database; never inherit the application's DB configuration.
if (!process.env.ALBUM_TEST_HOST) {
  throw new Error('Set ALBUM_TEST_HOST to a disposable MariaDB with database fromlog_test_album.');
}
const db = mysql.createPool({
  host: process.env.ALBUM_TEST_HOST,
  user: 'root',
  password: process.env.ALBUM_TEST_PASSWORD || '',
  database: 'fromlog_test_album',
  connectionLimit: 3,
});
let api;

before(async () => {
  await db.query(`CREATE TABLE IF NOT EXISTS albums (
    id INT PRIMARY KEY, title VARCHAR(200), album_type VARCHAR(100), album_type_short VARCHAR(50),
    release_date DATE, folder_name VARCHAR(200), description TEXT,
    cover_original_url TEXT, cover_medium_url TEXT, cover_thumb_url TEXT, theme_color VARCHAR(7)
  ) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE IF NOT EXISTS album_tracks (
    id INT AUTO_INCREMENT PRIMARY KEY, album_id INT NOT NULL, track_number INT NOT NULL,
    title VARCHAR(200) NOT NULL, duration VARCHAR(10), is_title_track TINYINT DEFAULT 0,
    lyricist VARCHAR(500), composer VARCHAR(500), arranger VARCHAR(500), lyrics TEXT,
    description TEXT, video_url VARCHAR(255), video_type ENUM('music_video', 'special'),
    UNIQUE KEY unique_album_track (album_id, track_number),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await db.query(await readFile(new URL('../sql/track_fanchant.sql', import.meta.url), 'utf8'));
  await db.query('ALTER TABLE track_fanchant ADD COLUMN IF NOT EXISTS published TINYINT NOT NULL DEFAULT 0');

  api = Fastify();
  api.decorate('db', db);
  api.decorate('redis', { del: async () => 0, scan: async () => ['0', []] });
  api.decorate('authenticate', async () => {});
  await api.register(multipart);
  await api.register(albumsRoutes);
  await api.ready();
});

beforeEach(async () => {
  await db.query('DELETE FROM albums');
  await db.query(`INSERT INTO albums (id, title, album_type, release_date, folder_name, description)
    VALUES (1, 'Album', 'EP', '2026-09-05', 'album', 'Original'),
           (2, 'Other album', 'EP', '2026-09-05', 'other', 'Other')`);
  await db.query(`INSERT INTO album_tracks
    (id, album_id, track_number, title, lyrics, description)
    VALUES (101, 1, 1, 'First', 'Original lyrics', 'Keep this description'),
           (102, 1, 2, 'Second', 'Second lyrics', NULL),
           (201, 2, 1, 'Other', NULL, NULL)`);
  for (const id of [101, 102, 201]) {
    await db.query(`INSERT INTO track_fanchant
      (track_id, video_id, published, color_call, color_sing, lines_json)
      VALUES (?, 'testvideo01', 1, '#123456', '#654321', ?)`,
    [id, JSON.stringify([{ t: 1.25, parts: [{ text: 'Test chant', type: 'call', t: 1.25 }] }])]);
  }
});

after(async () => {
  if (api) await api.close();
  await db.end();
});

async function tracks() {
  const [rows] = await db.query('SELECT * FROM album_tracks WHERE album_id = 1 ORDER BY track_number');
  return rows;
}

async function fanchants() {
  const [rows] = await db.query('SELECT * FROM track_fanchant ORDER BY track_id');
  return rows;
}

async function payload() {
  return {
    title: 'Album', album_type: 'EP', album_type_short: 'EP', release_date: '2026-09-05',
    folder_name: 'album', description: 'Edited description', tracks: await tracks(),
  };
}

async function saveThroughApi(data) {
  const boundary = 'album-test-boundary';
  return api.inject({
    method: 'PUT', url: '/1',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--\r\n`,
  });
}

test('album metadata edits preserve track IDs and fanchants through the API', async () => {
  const originalTracks = await tracks();
  const originalFanchants = await fanchants();
  const response = await saveThroughApi(await payload());
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(await tracks(), originalTracks);
  assert.deepEqual(await fanchants(), originalFanchants);
  const [[album]] = await db.query('SELECT description FROM albums WHERE id = 1');
  assert.equal(album.description, 'Edited description');
});

test('cover replacement preserves track IDs and fanchants', async () => {
  const originalTracks = await tracks();
  const originalFanchants = await fanchants();
  const send = S3Client.prototype.send;
  const keys = [];
  S3Client.prototype.send = async function (command) { keys.push(command.input.Key); return {}; };
  try {
    const cover = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abcdef' } }).png().toBuffer();
    await updateAlbum(db, 1, await payload(), cover);
    assert.equal(keys.length, 3);
    assert.deepEqual(await tracks(), originalTracks);
    assert.deepEqual(await fanchants(), originalFanchants);
  } finally {
    S3Client.prototype.send = send;
  }
});

test('editing a track preserves its identity and complete fanchant', async () => {
  const data = await payload();
  const originalFanchants = await fanchants();
  Object.assign(data.tracks[0], { title: 'Renamed', lyrics: 'Edited lyrics', is_title_track: true });
  await updateAlbum(db, 1, data, null);
  const saved = await tracks();
  assert.equal(saved[0].id, 101);
  assert.equal(saved[0].title, 'Renamed');
  assert.equal(saved[0].lyrics, 'Edited lyrics');
  assert.equal(saved[0].is_title_track, 1);
  assert.deepEqual(await fanchants(), originalFanchants);
});

test('swapping track numbers respects the unique constraint without replacing tracks', async () => {
  const data = await payload();
  const originalFanchants = await fanchants();
  data.tracks.reverse().forEach((track, index) => { track.track_number = index + 1; });
  await updateAlbum(db, 1, data, null);
  assert.deepEqual((await tracks()).map(t => [t.id, t.track_number]), [[102, 1], [101, 2]]);
  assert.deepEqual(await fanchants(), originalFanchants);
});

test('removing a track and adding another deletes only the removed track fanchant', async () => {
  const data = await payload();
  const originalFanchants = await fanchants();
  data.tracks = [{ ...data.tracks[1], track_number: 1 }, { title: 'New track', track_number: 2 }];
  await updateAlbum(db, 1, data, null);
  const saved = await tracks();
  assert.equal(saved[0].id, 102);
  assert.equal(saved[1].title, 'New track');
  assert(![101, 102, 201].includes(saved[1].id));
  assert.deepEqual(await fanchants(), originalFanchants.filter(f => f.track_id !== 101));
});

test('omitting tracks preserves them; an explicit empty array removes them', async () => {
  const data = await payload();
  const originalTracks = await tracks();
  const originalFanchants = await fanchants();
  delete data.tracks;
  await updateAlbum(db, 1, data, null);
  assert.deepEqual(await tracks(), originalTracks);
  assert.deepEqual(await fanchants(), originalFanchants);
  await updateAlbum(db, 1, { ...data, tracks: [] }, null);
  assert.deepEqual(await tracks(), []);
  assert.deepEqual(await fanchants(), originalFanchants.filter(f => f.track_id === 201));
});

for (const [name, mutate] of [
  ['another album track ID', d => { d.tracks[0].id = 201; }],
  ['a stale track ID', d => { d.tracks[0].id = 999999; }],
  ['duplicate IDs', d => { d.tracks[1].id = d.tracks[0].id; }],
  ['duplicate numbers', d => { d.tracks[1].track_number = 1; }],
  ['invalid numbers', d => { d.tracks[0].track_number = 0; }],
  ['null tracks', d => { d.tracks = null; }],
]) {
  test(`rejects ${name} with HTTP 400 and leaves data intact`, async () => {
    const data = await payload();
    const originalTracks = await tracks();
    const originalFanchants = await fanchants();
    mutate(data);
    const response = await saveThroughApi(data);
    assert.equal(response.statusCode, 400, response.body);
    assert.deepEqual(await tracks(), originalTracks);
    assert.deepEqual(await fanchants(), originalFanchants);
    const [[album]] = await db.query('SELECT description FROM albums WHERE id = 1');
    assert.equal(album.description, 'Original');
  });
}

test('an album save failure rolls back track changes and cascaded fanchant deletions', async () => {
  const data = await payload();
  const originalTracks = await tracks();
  const originalFanchants = await fanchants();
  data.tracks = [{ ...data.tracks[1], track_number: 1 }];
  data.release_date = 'invalid-date';
  await assert.rejects(updateAlbum(db, 1, data, null));
  assert.deepEqual(await tracks(), originalTracks);
  assert.deepEqual(await fanchants(), originalFanchants);
});
