import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import https from 'node:https';
import youtubePlugin from '../src/services/youtube/index.js';
import xPlugin from '../src/services/x/index.js';
import { promoteTempSchedule } from '../src/utils/tempSchedule.js';

// Opt in only on an isolated MariaDB container (no production credentials accepted).
test('isolated MariaDB bot ingestion contracts', { skip: process.env.BOT_AUDIT_DB !== '1' }, async t => {
  const database = `bot_audit_${process.pid}`;
  const admin = await mysql.createConnection({ host: '127.0.0.1', user: 'root', multipleStatements: true });
  await admin.query(`CREATE DATABASE ${database}`);
  t.after(async () => { await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  await admin.query(`USE ${database}`);
  await admin.query(await readFile(new URL('./fixtures/bot-schema.sql', import.meta.url), 'utf8'));
  const db = mysql.createPool({ host: '127.0.0.1', user: 'root', database, timezone: 'Z', connectionLimit: 10 });
  t.after(() => db.end());
  const errors = [];
  const indexed = new Map();
  const fastify = { db, redis: null, log: { info() {}, warn() {}, error(message) { errors.push(message); } },
    meilisearch: { waitForTask: async () => ({ status: 'succeeded' }), index: () => ({
      addDocuments: async docs => { for (const doc of docs) indexed.set(doc.id, doc); return { taskUid: 1 }; },
      deleteDocument: async id => { indexed.delete(id); return { taskUid: 2 }; },
    }) }, decorate(key, value) { this[key] = value; } };
  await youtubePlugin(fastify); await xPlugin(fastify);
  await db.query("INSERT INTO schedule_categories (id, name, color) VALUES (2, '유튜브', '#ff0000'), (3, 'X', '#000000')");
  await db.query("INSERT INTO bot_youtube (channel_id, channel_name, enabled) VALUES ('channel', '테스트채널', 1)");
  const publishedAt = '2026-09-24T10:00:00Z';
  let video, html, detailFails;
  // OG enrichment now uses a pinned native transport; never perform real I/O here.
  t.mock.method(https, 'request', () => { throw Error('OG enrichment unavailable in this fixture'); });
  const post = (id = '100', text = '프로미스나인 소식', card = '') => `<div class="timeline-item " data-username="account"><a href="/account/status/${id}"></a><span class="tweet-date"><a title="Sep 24, 2026 · 10:00 AM UTC"></a></span><div class="tweet-content">${text}</div>${card}</div>`;
  t.mock.method(globalThis, 'fetch', async (input, opts = {}) => {
    const url = new URL(input);
    if (url.host === 'nitter.test') return { ok: true, text: async () => html };
    if (url.host === 'www.youtube.com' && url.pathname.startsWith('/shorts/') && opts.method === 'HEAD') return { status: video.short ? 200 : 302 };
    if (url.host === 'www.googleapis.com') {
      if (url.pathname.endsWith('/activities')) return { json: async () => ({ items: [{ snippet: { ...video, type: 'upload' }, contentDetails: { upload: { videoId: video.videoId } } }] }) };
      if (url.pathname.endsWith('/videos')) {
        if (detailFails && url.searchParams.get('part').includes('snippet')) { detailFails--; throw new Error('temporary details failure'); }
        return { json: async () => ({ items: [{ id: video.videoId, snippet: video, contentDetails: { duration: video.durationISO } }] }) };
      }
    }
    if (['www.youtube.com', 'youtu.be'].includes(url.host) && opts.method !== 'HEAD') return { ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<html></html>' };
    throw new Error(`Unexpected external I/O: ${url.host}${url.pathname}`);
  });
  const ytBot = { id: 'youtube-1', channelId: 'channel', channelName: '테스트채널', filterMode: 'split', titleFilters: ['테스트 프로그램'], excludeShorts: true, minDurationSeconds: 300,
    autoScheduleNext: { dayOfWeek: 4, time: '19:00:00', weeksAhead: 1, deadlineDayOfWeek: 5, titleTemplate: '테스트 프로그램 EP.{episode}', episodeMatch: '테스트 프로그램' } };
  const xBot = { id: 'x-1', username: 'account', nitterUrl: 'https://nitter.test', extractYoutube: true, includeRetweets: true };
  const reset = async () => {
    for (const table of ['youtube_bot_processed', 'youtube_skipped_videos', 'videos', 'schedules', 'logs']) await db.query(`DELETE FROM ${table}`);
    errors.length = 0; indexed.clear(); detailFails = 0;
    video = { videoId: 'abcdefghijk', channelId: 'channel', channelTitle: '테스트채널', title: '테스트 프로그램 EP.01', description: '프로미스나인', publishedAt, durationISO: 'PT20M' };
    html = post('100', '프로미스나인 https://youtu.be/abcdefghijk');
  };
  const pending = async (title = '테스트 프로그램 EP.1', channel = 'channel', date = '2026-09-24') => {
    const [r] = await db.query('INSERT INTO schedules (category_id, title, date, time, is_temp) VALUES (2, ?, ?, ?, 1)', [title, date, '19:00:00']);
    await db.query("INSERT INTO schedule_youtube (schedule_id, video_type, channel_id) VALUES (?, 'video', ?)", [r.insertId, channel]);
    return r.insertId;
  };
  const rows = async () => (await db.query('SELECT s.id, s.title, s.is_temp, sy.video_id FROM schedules s JOIN schedule_youtube sy ON sy.schedule_id = s.id ORDER BY s.id'))[0];

  for (const order of ['X first', 'YouTube first', 'simultaneous']) {
    await t.test(`${order}: one video, archive and next episode survive retries`, async st => {
      st.mock.timers.enable({ apis: ['Date'], now: new Date(publishedAt) });
      await reset(); await pending();
      const x = () => fastify.xBot.syncNewTweets(xBot);
      const yt = () => fastify.youtubeBot.syncNewVideos(ytBot);
      if (order === 'X first') { await x(); await yt(); }
      else if (order === 'YouTube first') { await yt(); await x(); }
      else await Promise.all([x(), yt()]);
      await x(); await yt();
      assert.deepEqual(errors, []);
      const list = await rows();
      assert.equal(list.filter(r => r.video_id === video.videoId).length, 1);
      assert.deepEqual(list.filter(r => r.is_temp).map(r => r.title), ['테스트 프로그램 EP.2']);
      assert.equal((await db.query('SELECT * FROM videos'))[0].length, 1);
      assert.equal((await db.query('SELECT * FROM schedule_x'))[0].length, 1);
      assert.equal((await db.query('SELECT * FROM youtube_bot_processed'))[0].length, 1);
      assert.equal(indexed.size, 3);
    });
  }
  await t.test('simultaneous X polls cannot create duplicate posts without a unique index', async () => {
    await reset();
    await Promise.all(Array.from({ length: 3 }, () => fastify.xBot.syncNewTweets(xBot)));
    assert.deepEqual(errors, []);
    assert.equal((await db.query('SELECT * FROM schedule_x'))[0].length, 1);
    assert.equal((await rows()).length, 1);
  });
  await t.test('card-only YouTube link retries after X schedule already exists', async () => {
    await reset(); detailFails = 1;
    html = post('101', '프로미스나인 영상', '<a class="card-container" href="https://www.youtube.com/watch?feature=share&amp;v=abcdefghijk"><h2 class="card-title">영상</h2></a>');
    await fastify.xBot.syncNewTweets(xBot);
    assert.equal((await rows()).length, 0);
    await fastify.xBot.syncNewTweets(xBot);
    assert.equal((await rows()).length, 1);
    assert.equal((await db.query('SELECT * FROM schedule_x'))[0].length, 1);
    assert.equal(errors.length, 1);
  });
  await t.test('X imports a preview rejected by YouTube without consuming pending episode', async () => {
    await reset(); await pending();
    video.title = '예고편'; video.durationISO = 'PT24S';
    await fastify.xBot.syncNewTweets(xBot);
    await fastify.youtubeBot.syncNewVideos(ytBot);
    const list = await rows();
    assert.equal(list.filter(r => r.is_temp).length, 1);
    assert.equal(list.filter(r => r.video_id).length, 1);
    assert.deepEqual(errors, []);
  });
  await t.test('premiere metadata retries without creating a dated video schedule', async () => {
    await reset(); video.liveBroadcastContent = 'upcoming';
    await fastify.xBot.syncNewTweets(xBot);
    await fastify.youtubeBot.syncNewVideos(ytBot);
    assert.equal((await rows()).length, 0);
    video.liveBroadcastContent = 'none';
    await fastify.xBot.syncNewTweets(xBot);
    await fastify.youtubeBot.syncNewVideos(ytBot);
    assert.equal((await rows()).filter(r => r.video_id).length, 1);
  });
  await t.test('only one channel can promote an unassigned pending row concurrently', async () => {
    await reset(); const id = await pending('테스트 프로그램 EP.1', null);
    const base = { title: '테스트 프로그램 EP.01', videoType: 'video', date: '2026-09-24', time: '19:00:00' };
    const result = await Promise.all([
      promoteTempSchedule(db, { ...base, videoId: 'aaaaaaaaaaa', channelId: 'one' }),
      promoteTempSchedule(db, { ...base, videoId: 'bbbbbbbbbbb', channelId: 'two' }),
    ]);
    assert.equal(result.filter(r => r === id).length, 1);
    assert.equal(result.filter(r => r === null).length, 1);
    assert.equal((await rows()).length, 1);
  });
  await t.test('Sunday deadline deletes Friday pending and creates the next Friday', async st => {
    st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-26T15:05:00Z') });
    await reset(); const old = await pending('테스트 프로그램', 'channel', '2026-09-25');
    const bot = { ...ytBot, autoScheduleNext: { ...ytBot.autoScheduleNext, dayOfWeek: 5, deadlineDayOfWeek: 0 } };
    await fastify.youtubeBot.checkScheduledDeadline(bot);
    await fastify.youtubeBot.checkScheduledDeadline(bot);
    const list = (await db.query("SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS day FROM schedules WHERE is_temp = 1"))[0];
    assert.equal(list.length, 1); assert.notEqual(list[0].id, old); assert.equal(list[0].day, '2026-10-02');
  });
  await t.test('archive-only intentional interview/short exclusions report zero additions', async () => {
    await reset(); video.title = '프로미스나인 인터뷰';
    const bot = { ...ytBot, titleFilters: [], autoScheduleNext: null, addToSchedule: false, archiveShorts: false };
    assert.equal((await fastify.youtubeBot.syncNewVideos(bot)).addedCount, 0);
    assert.equal((await db.query('SELECT * FROM videos'))[0].length, 0);
    await reset(); video.durationISO = 'PT25S'; video.short = true;
    assert.equal((await fastify.youtubeBot.syncNewVideos(bot)).addedCount, 0);
    assert.equal((await db.query('SELECT * FROM videos'))[0].length, 0);
  });
  await t.test('retweet with matching prefix and different ending does not overwrite another post', async () => {
    await reset(); const prefix = '프로미스나인 행사 공지 '.repeat(12);
    html = post('110', prefix + '첫 번째 일정');
    await fastify.xBot.syncNewTweets({ ...xBot, extractYoutube: false });
    html = post('111', prefix + '다른 두 번째 일정').replace('<a href=', '<div class="retweet-header"></div><a href=');
    await fastify.xBot.syncNewTweets({ ...xBot, extractYoutube: false });
    assert.equal((await db.query('SELECT * FROM schedule_x'))[0].length, 2);
  });
});
