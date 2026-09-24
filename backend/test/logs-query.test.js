import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import logsRoutes from '../src/routes/admin/logs.js';

test('error filter affects both count and paginated rows, combined with dates and actor', async () => {
  const calls = [];
  const app = Fastify();
  app.decorate('authenticate', async () => {});
  app.decorate('db', { query: async (sql, params) => {
    calls.push({ sql, params });
    return sql.includes('COUNT(*)') ? [[{ total: 42 }]] : [[{ id: 5, actor: 'bot_x', action: 'error', category: 'bot', summary: 'failed', details: '{"error":"timeout"}', created_at: '2026-09-24 23:00:00' }]];
  } });
  await app.register(logsRoutes);
  try {
    const response = await app.inject('/?page=2&limit=20&action=error&actor=bot&category=bot,schedule&search=failed&from=2026-09-18&to=2026-09-24');
    assert.equal(response.statusCode, 200);
    const data = response.json();
    assert.equal(data.total, 42); assert.equal(data.totalPages, 3); assert.equal(data.page, 2);
    assert.deepEqual(data.logs[0].details, { error: 'timeout' });
    for (const call of calls) { assert.match(call.sql, /action = \?/); assert.match(call.sql, /actor != 'admin'/); }
    assert.deepEqual(calls[0].params, ['bot', 'schedule', 'error', '%failed%', '2026-09-18 00:00:00', '2026-09-24 23:59:59']);
    assert.deepEqual(calls[1].params, [...calls[0].params, 20, 20]);
    assert.match(calls[1].sql, /ORDER BY created_at DESC, id DESC/);
    assert.equal((await app.inject('/?action=unknown')).statusCode, 400);
    assert.equal((await app.inject('/?page=0')).statusCode, 400);
  } finally { await app.close(); }
});

test('existing all-log requests stay unfiltered; authentication remains required', async () => {
  const calls = [];
  const app = Fastify();
  app.decorate('authenticate', async (request, reply) => { if (!request.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' }); });
  app.decorate('db', { query: async (sql, params) => { calls.push({ sql, params }); return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]]; } });
  await app.register(logsRoutes);
  try {
    assert.equal((await app.inject('/')).statusCode, 401); assert.equal(calls.length, 0);
    const response = await app.inject({ url: '/?limit=4', headers: { authorization: 'test' } });
    assert.equal(response.statusCode, 200); assert.equal(response.json().totalPages, 0);
    assert.doesNotMatch(calls[0].sql, /action =/); assert.deepEqual(calls[1].params, [4, 0]);
  } finally { await app.close(); }
});
