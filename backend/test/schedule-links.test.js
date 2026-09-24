import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import routes from '../src/routes/admin/scheduleLinks.js';
import publicRoutes from '../src/routes/scheduleLinks.js';

async function fixture() {
  const calls = [], events = [];
  let failOrder = false;
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('MAX(sort_order)')) return [[{ next: 3 }]];
    if (sql.includes('FOR UPDATE')) return [[{ id: 1 }, { id: 2 }]];
    if (sql.startsWith('SELECT')) return [[{ id: 1, title: 'Test', is_enabled: 0 }]];
    if (failOrder && sql.includes('SET sort_order')) throw Error('test failure');
    return [{ insertId: 3 }];
  } };
  db.getConnection = async () => ({ query: db.query, beginTransaction: async () => events.push('begin'), commit: async () => events.push('commit'), rollback: async () => events.push('rollback'), release: () => events.push('release') });
  const app = Fastify();
  app.decorate('db', db);
  app.decorate('authenticate', async (req, reply) => { if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' }); });
  await app.register(routes, { prefix: '/admin' });
  await app.register(publicRoutes, { prefix: '/public' });
  return { app, calls, events, fail: () => { failOrder = true; }, request: (method, url, payload) => app.inject({ method, url: `/admin${url}`, payload, headers: { authorization: 'test' } }) };
}
test('visibility preserves old clients and wall-clock periods; public query requires enabled', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.app.inject('/admin')).statusCode, 401);
    assert.equal(f.calls.length, 0);
    const body = { title: 'Title', url: 'https://example.com', startsAt: '2026-09-24T19:00', endsAt: null };
    assert.equal((await f.request('POST', '/', body)).statusCode, 201);
    let q = f.calls.find(c => c.sql.startsWith('INSERT INTO schedule_links'));
    assert.deepEqual(q.params.slice(2), ['2026-09-24 19:00:00', null, 3, 1]);
    assert.equal((await f.request('PUT', '/1', body)).statusCode, 200);
    q = f.calls.find(c => c.sql.includes('COALESCE(?, is_enabled)'));
    assert.equal(q.params[4], null);
    assert.equal((await f.request('PATCH', '/1/visibility', { enabled: false })).statusCode, 200);
    assert.ok(f.calls.some(c => c.sql === 'UPDATE schedule_links SET is_enabled = ? WHERE id = ?' && c.params[0] === 0));
    assert.equal((await f.request('PATCH', '/1/visibility', {})).statusCode, 400);
    assert.equal((await f.request('GET', '/')).json()[0].enabled, false);
    await f.app.inject('/public');
    q = f.calls.at(-1);
    assert.match(q.sql, /is_enabled = 1/); assert.match(q.sql, /starts_at <= NOW\(\)/); assert.match(q.sql, /ends_at\s+>= NOW\(\)/);
  } finally { await f.app.close(); }
});
test('reorder rejects stale and duplicate lists and rolls back database failures', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('PUT', '/order', { ids: [1, 1] })).statusCode, 400);
    assert.equal((await f.request('PUT', '/order', { ids: [1] })).statusCode, 400);
    assert.ok(!f.calls.some(c => c.sql.includes('SET sort_order')));
    assert.equal((await f.request('PUT', '/order', { ids: [2, 1] })).statusCode, 200);
    assert.deepEqual(f.calls.filter(c => c.sql.includes('SET sort_order')).map(c => c.params), [[1, 2], [2, 1]]);
    assert.ok(f.calls.some(c => c.sql.startsWith('INSERT INTO logs')));
    f.fail();
    assert.equal((await f.request('PUT', '/order', { ids: [1, 2] })).statusCode, 500);
    assert.deepEqual(f.events.slice(-3), ['begin', 'rollback', 'release']);
  } finally { await f.app.close(); }
});
