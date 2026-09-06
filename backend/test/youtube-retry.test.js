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
  const state = { archived: new Map(), saved: new Map(), skipped: new Set(), schedules: new Map(), logs: [] };
  const calls = { activities: 0, durations: 0, details: 0, promotions: 0, rollbacks: 0 };
  const fail = { detail: null, insert: false, promote: false };
  let nextId = 1;
  const query = async (rawSql, params = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT video_id FROM schedule_youtube')) return [[...state.saved.keys()].filter(id => params[0].includes(id)).map(video_id => ({ video_id }))];
    if (sql.startsWith('SELECT video_id FROM youtube_skipped')) return [[...state.skipped].filter(id => params[0].includes(id)).map(video_id => ({ video_id }))];
    if (sql.startsWith('SELECT video_id, video_type FROM videos')) return [[...state.archived.values()].filter(row => params[0].includes(row.video_id))];
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
    if (sql.startsWith('SELECT id FROM schedule_youtube')) return [state.saved.has(params[0]) ? [{ id: state.saved.get(params[0]) }] : []];
    if (sql.startsWith('SELECT s.id, s.title')) {
      calls.promotions++;
      if (fail.promote) { fail.promote = false; throw new Error('Temporary promotion DB failure'); }
      return [[...state.schedules.values()].filter(s => s.is_temp).map(s => ({ id: s.id, title: s.title }))];
    }
    if (sql.startsWith('INSERT INTO schedules')) {
      const id = nextId++;
      state.schedules.set(id, { id, title: params[1], is_temp: false });
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
    if (url.hostname === 'www.youtube.com' && url.pathname.startsWith('/shorts/')) return { status: 200 };
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
      items = uploads.filter(u => ids.includes(u.videoId)).map(u => ({ id: u.videoId, snippet: u, contentDetails: { duration: u.short ? 'PT30S' : 'PT20M' } }));
    } else throw new Error('Unexpected network request');
    return { json: async () => ({ items }) };
  });
  const fastify = { db, redis: null, meilisearch: null, log: { info() {} }, decorate(key, value) { this[key] = value; } };
  await youtubeBotPlugin(fastify);
  const bot = { id: 'retry-test', channelId: 'channel', channelName: '워크돌', titleFilters: [], addToSchedule: true, ...options };
  return { state, calls, fail, run: () => fastify.youtubeBot.syncNewVideos(bot) };
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

test('registered and explicitly excluded videos never reach detail lookup', async t => {
  const f = await fixture(t, [upload('saved'), upload('skipped')]);
  f.state.saved.set('saved', 10);
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
