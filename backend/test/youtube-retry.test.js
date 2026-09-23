import assert from 'node:assert/strict';
import { test } from 'node:test';
import youtubeBotPlugin from '../src/services/youtube/index.js';

const upload = (id, extra = {}) => ({
  videoId: id, title: `프로미스나인 워크돌 ${id}`, description: '프로미스나인 출연',
  channelId: 'channel', channelTitle: '워크돌', publishedAt: '2026-09-05T09:00:00Z',
  ...extra,
});

// Exercise the original bot, API parsing and transactions; replace only external I/O.
async function fixture(t, uploads = [upload('one')], options = {}) {
  const state = { archived: new Map(), saved: new Map(), skipped: new Set(), schedules: new Map(), logs: [], processed: new Map() };
  const calls = { activities: 0, durations: 0, details: 0, promotions: 0, rollbacks: 0 };
  const fail = { detail: null, insert: false, promote: false };
  let nextId = 1;
  const query = async (rawSql, params = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }]];
    if (sql.startsWith('SELECT RELEASE_LOCK')) return [[{ released: 1 }]];
    if (sql.startsWith('SELECT video_id, is_target')) return [[...state.processed.values()].filter(r => params[1].includes(r.video_id))];
    if (sql.startsWith('INSERT IGNORE INTO youtube_bot_processed')) {
      state.processed.set(params[1], { video_id: params[1], is_target: params[2], video_date: params[3] }); return [{}];
    }
    if (sql.startsWith('SELECT video_id FROM schedule_youtube')) return [[...state.saved.keys()].filter(id => params[0].includes(id)).map(video_id => ({ video_id }))];
    if (sql.startsWith('SELECT video_id FROM youtube_skipped')) return [[...state.skipped].filter(id => params[0].includes(id)).map(video_id => ({ video_id }))];
    if (sql.startsWith('SELECT video_id, video_type, duration FROM videos')) return [[...state.archived.values()].filter(row => params[0].includes(row.video_id))];
    if (sql.startsWith('INSERT IGNORE INTO videos')) {
      const [id, , , title, , video_type] = params;
      const exists = state.archived.has(id);
      if (!exists) state.archived.set(id, { video_id: id, video_type, title });
      return [{ affectedRows: exists ? 0 : 1 }];
    }
    if (sql.startsWith('INSERT IGNORE INTO youtube_skipped')) {
      for (const [id] of params[0]) state.skipped.add(id);
      return [{}];
    }
    if (sql.startsWith('SELECT id FROM schedule_youtube') || sql.startsWith('SELECT id, schedule_id FROM schedule_youtube')) return [state.saved.has(params[0]) ? [{ id: state.saved.get(params[0]), schedule_id: state.saved.get(params[0]) }] : []];
    if (sql.startsWith('SELECT s.id, s.title, sy.channel_id')) return [[...state.schedules.values()].filter(s => s.is_temp)];
    if (sql.startsWith('DELETE s FROM schedules')) { const deleted = state.schedules.delete(params[0]); return [{ affectedRows: deleted ? 1 : 0 }]; }
    if (sql.startsWith('SELECT sy.schedule_id')) return [[...state.schedules.values()].filter(s => s.is_temp && s.date === params[1]).map(s => ({ schedule_id: s.id, ...s }))];
    if (sql.startsWith('SELECT s.title, sy.video_type')) return [[...state.schedules.values()].filter(s => !s.is_temp).map(s => ({ title: s.title, videoType: 'video', duration: 1200 }))];
    if (sql.startsWith('SELECT s.id, s.title')) {
      calls.promotions++;
      if (fail.promote) { fail.promote = false; throw new Error('Temporary promotion DB failure'); }
      return [[...state.schedules.values()].filter(s => s.is_temp).map(s => ({ id: s.id, title: s.title }))];
    }
    if (sql.startsWith('INSERT INTO schedules')) {
      const id = nextId++;
      state.schedules.set(id, { id, title: params[1], date: params[2], time: params[3], channel_id: 'channel', is_temp: sql.includes('?, 1)') });
      return [{ insertId: id }];
    }
    if (sql.startsWith('INSERT INTO schedule_youtube')) {
      if (fail.insert) { fail.insert = false; throw new Error('Temporary schedule DB failure'); }
      state.saved.set(params[1], params[0]);
      return [{}];
    }
    if (sql.startsWith('UPDATE schedules SET title')) {
      Object.assign(state.schedules.get(params[3]), { title: params[0], is_temp: false });
      return [{}];
    }
    if (sql.startsWith('UPDATE schedule_youtube SET video_id')) {
      state.saved.set(params[0], params.at(-1));
      return [{}];
    }
    if (sql.startsWith('INSERT INTO logs')) { state.logs.push(params); return [{}]; }
    if (sql.includes('GROUP BY s.id')) return [[]]; // Search indexing is outside this regression.
    throw new Error(`Unexpected fixture SQL: ${sql}`);
  };
  const db = { query, async getConnection() {
    let backup;
    return { query,
      async beginTransaction() { backup = structuredClone({ saved: state.saved, schedules: state.schedules }); },
      async commit() {},
      async rollback() { Object.assign(state, backup); calls.rollbacks++; },
      release() {},
    };
  } };
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.hostname === 'www.youtube.com' && url.pathname.startsWith('/shorts/')) return { status: uploads.find(u => u.videoId === url.pathname.split('/').pop())?.short ? 200 : 302 };
    const ids = (url.searchParams.get('id') || '').split(',');
    let items;
    if (url.pathname.endsWith('/activities')) {
      calls.activities++;
      items = uploads.map(u => ({ snippet: { ...u, type: 'upload' }, contentDetails: { upload: { videoId: u.videoId } } }));
    } else if (url.pathname.endsWith('/videos')) {
      const details = url.searchParams.get('part').includes('snippet');
      if (details) {
        calls.details++;
        if (fail.detail === 'throw') { fail.detail = null; throw new Error('Temporary YouTube failure'); }
        if (fail.detail === 'empty') { fail.detail = null; return { json: async () => ({ items: [] }) }; }
      } else calls.durations++;
      items = uploads.filter(u => ids.includes(u.videoId)).map(u => ({ id: u.videoId, snippet: u, contentDetails: { duration: u.durationISO ?? (u.short ? 'PT30S' : 'PT20M') } }));
    } else throw new Error('Unexpected network request');
    return { json: async () => ({ items }) };
  });
  const fastify = { db, redis: null, meilisearch: { index: () => ({ deleteDocument: async () => ({}), addDocuments: async () => ({}) }) }, log: { info() {} }, decorate(key, value) { this[key] = value; } };
  await youtubeBotPlugin(fastify);
  const bot = { id: 'retry-test', channelId: 'channel', channelName: '워크돌', titleFilters: [], addToSchedule: true, ...options };
  return { state, calls, fail, save: video => fastify.youtubeBot.saveVideo(video, bot), run: () => fastify.youtubeBot.syncNewVideos(bot) };
}

for (const failure of ['throw', 'empty']) {
  test(`schedule retries after archived video detail ${failure}`, async t => {
    const f = await fixture(t);
    f.fail.detail = failure;
    if (failure === 'throw') await assert.rejects(f.run(), /Temporary YouTube/);
    else assert.equal((await f.run()).addedCount, 0);
    assert.equal(f.state.archived.size, 1);
    assert.equal(f.state.saved.size, 0);
    assert.equal((await f.run()).addedCount, 1);
    assert.equal(f.state.saved.size, 1);
    const detailCalls = f.calls.details;
    assert.equal((await f.run()).addedCount, 0);
    assert.equal(f.calls.details, detailCalls);
    assert.equal(f.state.schedules.size, 1);
  });
}

test('schedule DB rollback remains retryable without duplicating the archive', async t => {
  const f = await fixture(t);
  f.fail.insert = true;
  await assert.rejects(f.run(), /Temporary schedule/);
  assert.equal(f.calls.rollbacks, 1);
  assert.equal(f.state.schedules.size, 0);
  assert.equal(f.state.archived.size, 1);
  await f.run();
  await f.run();
  assert.equal(f.state.schedules.size, 1);
  assert.equal(f.state.archived.size, 1);
});

test('one failed candidate does not permanently hide the rest of an archived batch', async t => {
  const f = await fixture(t, [upload('one'), upload('two')]);
  f.fail.detail = 'throw';
  await assert.rejects(f.run());
  assert.equal(f.state.archived.size, 2);
  assert.equal((await f.run()).addedCount, 2);
  assert.equal((await f.run()).addedCount, 0);
  assert.equal(f.state.schedules.size, 2);
});

test('completed bot work and explicitly excluded videos never reach detail lookup', async t => {
  const f = await fixture(t, [upload('saved'), upload('skipped')]);
  f.state.saved.set('saved', 10);
  f.state.processed.set('saved', { video_id: 'saved', is_target: 0, video_date: '2026-09-05' });
  f.state.skipped.add('skipped');
  await f.run();
  assert.equal(f.calls.durations, 0);
  assert.equal(f.calls.details, 0);
});

test('shorts and title filters still create durable exclusions', async t => {
  const f = await fixture(t, [upload('short', { short: true }), upload('rejected', { title: '다른 출연자', description: '다른 출연자' })], { excludeShorts: true, titleFilters: ['프로미스나인'] });
  await f.run();
  const durationCalls = f.calls.durations;
  await f.run();
  assert.deepEqual([...f.state.skipped].sort(), ['rejected', 'short']);
  assert.equal(f.calls.durations, durationCalls);
  assert.equal(f.calls.details, 0);
  assert.equal(f.state.schedules.size, 0);
});

test('archive-only promotion retries from stored metadata without extra video API calls', async t => {
  const f = await fixture(t, [upload('one')], { addToSchedule: false });
  f.state.schedules.set(10, { id: 10, title: '워크돌 one', is_temp: true });
  f.fail.promote = true;
  await assert.rejects(f.run(), /Temporary promotion/);
  assert.equal(f.state.archived.size, 1);
  assert.equal(f.state.saved.size, 0);
  assert.equal((await f.run()).addedCount, 1);
  assert.equal(f.state.saved.get('one'), 10);
  assert.equal(f.state.schedules.size, 1);
  assert.equal(f.calls.durations, 1);
  assert.equal(f.calls.details, 0);
  const promotions = f.calls.promotions;
  assert.equal((await f.run()).addedCount, 0);
  assert.equal(f.calls.promotions, promotions);
  assert.equal(f.state.logs.length, 1);
});

test('archive-only polling creates no schedule without a matching pending entry', async t => {
  const f = await fixture(t, [upload('one')], { addToSchedule: false });
  await f.run();
  assert.equal((await f.run()).addedCount, 0);
  assert.equal(f.state.schedules.size, 0);
  assert.equal(f.state.archived.size, 1);
  assert.equal(f.calls.durations, 1);
  assert.equal(f.calls.details, 0);
});


test('X-first schedule does not skip archive or bot completion, then remains idempotent', async t => {
  const f = await fixture(t, [upload('x-first')]);
  f.state.saved.set('x-first', 12);
  f.state.schedules.set(12, { id: 12, title: 'existing X video', is_temp: false });
  assert.equal((await f.run()).addedCount, 0);
  assert.equal(f.state.archived.size, 1);
  assert.equal(f.state.processed.size, 1);
  const details = f.calls.details;
  await f.run();
  assert.equal(f.calls.details, details);
  assert.equal(f.state.schedules.size, 1);
});

test('short regular preview is excluded while shorts retain their own policy', async t => {
  const f = await fixture(t, [upload('preview'), upload('short', { short: true })], { minDurationSeconds: 1800 });
  await f.run();
  assert.ok(f.state.skipped.has('preview'));
  assert.ok(f.state.saved.has('short'));
  assert.ok(!f.state.saved.has('preview'));
});


test('unknown duration is retried, rather than permanently excluded as shorts', async t => {
  const u = upload('waiting', { durationISO: 'PT0S' });
  const f = await fixture(t, [u], { minDurationSeconds: 300, excludeShorts: true });
  await f.run();
  assert.equal(f.state.skipped.size, 0);
  assert.equal(f.state.processed.size, 0);
  u.durationISO = 'PT20M';
  await f.run();
  assert.equal(f.state.saved.size, 1);
});

test('archive-only bot fills missing archive even when X already created the schedule', async t => {
  const f = await fixture(t, [upload('x-first')], { addToSchedule: false });
  f.state.saved.set('x-first', 12);
  f.state.schedules.set(12, { id: 12, title: 'existing', is_temp: false });
  await f.run(); await f.run();
  assert.equal(f.state.archived.size, 1);
  assert.equal(f.state.schedules.size, 1);
  assert.equal(f.state.processed.size, 1);
});

test('X-first full episode reconciles pending and creates next episode exactly once', async t => {
  const { todayKST } = await import('../src/utils/date.js');
  const date = todayKST();
  const bot = { titleFilters: ['방판소녀들 시즌2'], minDurationSeconds: 300,
    autoScheduleNext: { dayOfWeek: 4, weeksAhead: 1, time: '19:00:00', titleTemplate: '방판소녀들 시즌2 EP.{episode}', episodeMatch: '방판소녀들 시즌2' } };
  const f = await fixture(t, [], bot);
  f.state.saved.set('main', 12);
  f.state.schedules.set(12, { id: 12, title: '방판소녀들 시즌2 EP.02', date, is_temp: false });
  f.state.schedules.set(13, { id: 13, title: '방판소녀들 시즌2 EP.02', date, channel_id: 'channel', is_temp: true });
  const video = { videoId: 'main', title: '방판소녀들 시즌2 EP.02', date, videoType: 'video', duration: 1270 };
  await f.save(video); await f.save(video);
  assert.ok(!f.state.schedules.has(13));
  const pending = [...f.state.schedules.values()].filter(s => s.is_temp);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].title, '방판소녀들 시즌2 EP.3');
});


test('today preview does not stop polling; later full episode does even if X already saved it', async t => {
  const publishedAt = new Date().toISOString();
  const uploads = [upload('preview', { title: '방판소녀들 시즌2 EP.02', durationISO: 'PT25S', publishedAt })];
  const f = await fixture(t, uploads, { titleFilters: ['방판소녀들 시즌2'], minDurationSeconds: 300, excludeShorts: true });
  assert.equal((await f.run()).foundTarget, false);
  assert.ok(f.state.skipped.has('preview'));
  uploads.push(upload('main', { title: '방판소녀들 시즌2 EP.02', publishedAt }));
  f.state.saved.set('main', 12);
  f.state.schedules.set(12, { id: 12, title: '방판소녀들 시즌2 EP.02', is_temp: false });
  const result = await f.run();
  assert.equal(result.foundTarget, true);
  assert.equal(result.addedCount, 0);
  assert.equal((await f.run()).foundTarget, true);
  assert.equal(f.state.schedules.size, 1);
});
