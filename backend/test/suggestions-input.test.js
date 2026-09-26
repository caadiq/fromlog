import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import suggestionsRoutes from '../src/routes/schedules/suggestions.js';
import { SuggestionService } from '../src/services/suggestions/index.js';

test('suggestion routes reject excessive input before storage or NLP and preserve normal queries', async t => {
  const calls = [];
  t.mock.method(SuggestionService.prototype, 'initialize', async () => {});
  t.mock.method(SuggestionService.prototype, 'getSuggestions', async (q, limit) => { calls.push([q, limit]); return ['결과']; });
  t.mock.method(SuggestionService.prototype, 'getPopularQueries', async limit => { calls.push(limit); return ['인기']; });
  t.mock.method(SuggestionService.prototype, 'saveSearchQuery', async query => { calls.push(query); });
  const api = Fastify();
  api.decorate('authenticate', async () => {});
  await api.register(suggestionsRoutes);
  t.after(() => api.close());
  for (const url of ['/?limit=0', '/?limit=-1', '/?limit=21', '/?limit=1.5', '/popular?limit=0', '/popular?limit=999999', '/?q=' + 'a'.repeat(256)]) assert.equal((await api.inject(url)).statusCode, 400, url);
  for (const query of ['', 'x'.repeat(256)]) assert.equal((await api.inject({ method: 'POST', url: '/save', payload: { query } })).statusCode, 400);
  assert.equal(calls.length, 0);
  assert.equal((await api.inject('/?q=프로미스나인')).statusCode, 200);
  assert.deepEqual(calls[0], ['프로미스나인', 10]);
  assert.equal((await api.inject('/popular?limit=20')).statusCode, 200);
  assert.equal((await api.inject({ method: 'POST', url: '/save', payload: { query: '가'.repeat(255) } })).statusCode, 200);
});
