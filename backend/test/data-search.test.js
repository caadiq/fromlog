import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { searchSchedules, syncAllSchedules, syncWithRetry, syncScheduleById, deleteSchedule } from '../src/services/meilisearch/index.js';
import { getMonthlySchedules } from '../src/services/schedule.js';
import { formatVideo } from '../src/routes/videos.js';
import adminVideos from '../src/routes/admin/videos.js';
import categoriesRoutes from '../src/routes/admin/schedule-categories.js';

const row = (id, extra = {}) => ({ id, title: `Title ${id}`, date: '2026-09-01', time: null, category_id: 11, category_name: '행사', category_color: '#fff', ...extra });
function searchFixture(rows, hits) {
  const calls = [];
  return {
    calls,
    db: { query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.includes('SELECT DISTINCT school_name')) return [[]];
      return [rows.filter(r => args.includes(r.id))];
    } },
    meili: { index: () => ({ search: async (_, opts) => ({ hits: hits.slice(0, opts.limit) }) }) },
  };
}
test('search preserves month precision, album routes and source URL; removes stale IDs before pagination', async () => {
  const rows = [row(1, { date_precision: 'month' }), row(2, { category_id: 17, album_folder: 'glow' }), row(3, { category_id: 2, youtube_video_id: 'abcdefghijk', youtube_video_type: 'shorts', youtube_channel: 'channel' })];
  const f = searchFixture(rows, [99, 1, 2, 3].map((id, i) => ({ id, _rankingScore: 1 - i / 100 })));
  const result = await searchSchedules(f.meili, f.db, '검색', { offset: 0, limit: 2 });
  assert.equal(result.total, 3); assert.equal(result.hasMore, true);
  assert.equal(result.hits[0].datePrecision, 'month');
  assert.equal(result.hits[1].albumFolder, 'glow');
  const last = await searchSchedules(f.meili, f.db, '검색', { offset: 2, limit: 2 });
  assert.match(last.hits[0].source.url, /shorts\/abcdefghijk$/); assert.equal(last.hasMore, false);
});
test('search passes 1000 matches and orders equal scores by date/time/id', async () => {
  const rows = Array.from({ length: 1205 }, (_, i) => row(i + 1));
  const hits = rows.map(r => ({ ...r, _rankingScore: 1 }));
  const f = searchFixture(rows, hits);
  const result = await searchSchedules(f.meili, f.db, '검색', { offset: 1200, limit: 20 });
  assert.equal(result.total, 1205); assert.deepEqual(result.hits.map(r => r.id), [5, 4, 3, 2, 1]);
  assert.ok(f.calls.filter(c => c.sql.includes('s.id IN')).every(c => c.args.length <= 500));
});
test('search outages propagate as failures instead of zero matches', async () => {
  const f = searchFixture([], []);
  f.meili.index = () => ({ search: async () => { throw Error('offline'); } });
  await assert.rejects(searchSchedules(f.meili, f.db, '검색'), /offline/);
});
test('sync confirms queued tasks and does not recreate indexes after empty DB or failures', async () => {
  const events = [];
  const index = { getDocuments: async () => ({ results: [{ id: 9 }] }), deleteDocuments: async () => ({ taskUid: 1 }), addDocuments: async () => ({ taskUid: 2 }) };
  const meili = { index: () => index, waitForTask: async id => { events.push(id); return { status: 'succeeded' }; }, deleteIndex: () => { throw Error('must not drop'); } };
  assert.equal(await syncWithRetry(meili, { query: async () => [[]] }), 0);
  assert.deepEqual(events, [1]);
  meili.waitForTask = async () => ({ status: 'failed', error: { message: 'index rejected' } });
  await assert.rejects(syncAllSchedules(meili, { query: async () => [[row(1)]] }), /index rejected/);
  assert.equal(await syncScheduleById(meili, { query: async () => [[row(1)]] }, 1), false);
  let tries = 0;
  await assert.rejects(syncWithRetry(meili, { query: async () => { tries++; throw Error('database unavailable'); } }), /database unavailable/);
  assert.equal(tries, 2);
});
test('deletion invalidates monthly cache even when the index is down', async () => {
  const deleted = [];
  const redis = { scan: async () => ['0', ['schedule:monthly:2026:9']], del: async (...keys) => deleted.push(...keys) };
  await deleteSchedule({ index: () => ({ deleteDocument: async () => { throw Error('offline'); } }) }, 1, redis);
  assert.deepEqual(deleted, ['schedule:monthly:2026:9']);
});
test('month-end, birthdays and anniversaries do not depend on process timezone', async () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Seoul', 'America/Los_Angeles']) {
      process.env.TZ = zone;
      const ranges = [];
      const db = { query: async (sql, args) => {
        if (sql.includes('BETWEEN')) { ranges.push(args); return [[]]; }
        if (sql.includes('FROM members')) return [[{ name_en: 'TEST', birth_date: new Date('2000-01-31T00:00:00Z') }]];
        return [[{ id: 8 }, { id: 9 }]];
      } };
      const result = await getMonthlySchedules(db, 2026, 1);
      assert.deepEqual(ranges[0], ['2026-01-01', '2026-01-31']);
      assert.ok(result.schedules.some(r => r.is_birthday && r.date === '2026-01-31'));
      assert.ok(result.schedules.some(r => r.is_anniversary && r.date === '2026-01-24'));
      await getMonthlySchedules(db, 2028, 2);
      assert.equal(ranges[1][1], '2028-02-29');
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test('admin/public video timestamps and members agree, including late-night publication', async () => {
  const video = { video_id: 'abcdefghijk', published_at: new Date('2026-09-24T21:00:00Z'), members: '["지원"]' };
  const app = Fastify();
  app.decorate('authenticate', async () => {});
  app.decorate('db', { query: async sql => {
    if (sql.includes('COUNT(*)')) return [[{ total: 1 }]];
    if (sql.includes('DISTINCT')) return [[]];
    assert.match(sql, /published_at DESC, id DESC/);
    return [[video]];
  } });
  await app.register(adminVideos);
  try {
    const response = await app.inject('/');
    assert.equal(response.statusCode, 200);
    const admin = response.json().videos[0], publicVideo = formatVideo(video);
    assert.equal(admin.publishedAt, '2026-09-24 21:00');
    assert.equal(admin.publishedAt, publicVideo.publishedAt);
    assert.deepEqual(admin.members, ['지원']);
    assert.equal(formatVideo({ published_at: '2026-09-24 21:00:00' }).publishedAt, admin.publishedAt);
  } finally { await app.close(); }
});
test('category edit refreshes category/month cache and affected search documents', async () => {
  const deleted = [], indexed = [];
  const app = Fastify();
  app.decorate('authenticate', async () => {});
  app.decorate('redis', { del: async (...keys) => deleted.push(...keys), scan: async () => ['0', ['schedule:monthly:2026:9']] });
  app.decorate('db', { query: async sql => {
    if (sql.includes('SELECT * FROM schedule_categories')) return [[{ id: 11, name: 'Old', color: '#fff', sort_order: 1 }]];
    if (sql.includes('SELECT id FROM schedules')) return [[{ id: 1 }]];
    if (sql.includes('FROM schedules s')) return [[row(1, { category_name: 'New' })]];
    return [{ insertId: 1 }];
  } });
  app.decorate('meilisearch', { index: () => ({ addDocuments: async docs => { indexed.push(...docs); return { taskUid: 1 }; } }), waitForTask: async () => ({ status: 'succeeded' }) });
  await app.register(categoriesRoutes);
  try {
    const response = await app.inject({ method: 'PUT', url: '/schedule-categories/11', payload: { name: 'New' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(deleted, ['categories:all', 'schedule:monthly:2026:9']);
    assert.equal(indexed[0].category_name, 'New');
  } finally { await app.close(); }
});

test('video format edit updates archive and schedule atomically and clears calendar cache', async () => {
  const events = [], queries = [];
  const connection = { query: async (sql, args) => { queries.push({ sql, args }); }, beginTransaction: async () => events.push('begin'), commit: async () => events.push('commit'), rollback: async () => events.push('rollback'), release: () => events.push('release') };
  const app = Fastify();
  app.decorate('authenticate', async () => {});
  app.decorate('db', { query: async sql => sql.startsWith('SELECT') ? [[{ title: 'Video' }]] : [{}], getConnection: async () => connection });
  app.decorate('redis', { scan: async () => ['0', ['schedule:monthly:2026:9']], del: async () => events.push('invalidate') });
  await app.register(adminVideos);
  try {
    const edit = () => app.inject({ method: 'PUT', url: '/abcdefghijk', payload: { video_type: 'shorts' } });
    assert.equal((await edit()).statusCode, 200);
    assert.deepEqual(events, ['begin', 'commit', 'release', 'invalidate']);
    assert.equal(queries.length, 2);
    assert.ok(queries.some(q => q.sql.startsWith('UPDATE schedule_youtube')));
    assert.ok(queries.every(q => q.args[0] === 'shorts' && q.args[1] === 'abcdefghijk'));
    connection.query = async () => { throw Error('database failure'); };
    assert.equal((await edit()).statusCode, 500);
    assert.deepEqual(events.slice(-3), ['begin', 'rollback', 'release']);
  } finally { await app.close(); }
});

test('manual YouTube schedule creation rolls back when archive insert fails', async () => {
  const { default: youtubeRoutes } = await import('../src/routes/admin/youtube.js');
  const events = [];
  const connection = {
    beginTransaction: async () => events.push('begin'), commit: async () => events.push('commit'), rollback: async () => events.push('rollback'), release: () => events.push('release'),
    query: async sql => {
      if (sql.includes('bot_youtube')) return [[{ video_category: 'official' }]];
      if (sql.includes('INSERT IGNORE INTO videos')) throw Error('archive insert failed');
      if (sql.includes('INSERT INTO schedules')) return [{ insertId: 1 }];
      return [{}];
    },
  };
  const app = Fastify();
  app.decorate('db', { query: async () => [[]], getConnection: async () => connection });
  app.decorate('authenticate', async () => {});
  await app.register(youtubeRoutes);
  try {
    const response = await app.inject({ method: 'POST', url: '/schedule', payload: { videoId: 'abcdefghijk', title: 'Video', channelId: 'test', date: '2026-09-24', time: '21:00' } });
    assert.equal(response.statusCode, 500);
    assert.match(response.body, /archive insert failed/);
    assert.deepEqual(events, ['begin', 'rollback', 'release']);
  } finally { await app.close(); }
});
