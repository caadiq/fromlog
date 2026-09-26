import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';

process.env.JWT_SECRET = 'isolated-route-auth-test-secret';
const { default: auth } = await import('../src/plugins/auth.js');
const { default: routes } = await import('../src/routes/index.js');
const schemas = await import('../src/schemas/index.js');

test('all privileged routes reject unauthenticated requests before handler side effects', async t => {
  const app = Fastify(); t.after(() => app.close());
  const inventory = [];
  app.decorate('db', { query: async () => { throw new Error('Unexpected DB access'); } });
  app.decorate('config', {});
  await app.register(auth);
  for (const [id, value] of Object.entries({ Album: schemas.albumResponse, AlbumTrack: schemas.albumTrack, Schedule: schemas.scheduleResponse, ScheduleCategory: schemas.scheduleCategory, Member: schemas.memberResponse, Photo: schemas.photoResponse })) app.addSchema({ $id: id, ...value });
  app.addHook('onRoute', route => {
    if (route.method === 'HEAD') return;
    const hooks = [route.preHandler].flat().filter(Boolean);
    inventory.push({ method: route.method, url: route.url, protected: hooks.includes(app.authenticate) });
    // Remove request schemas only in this fixture so the authentication boundary
    // is exercised even without constructing bodies for every mutation route.
    if (hooks.includes(app.authenticate)) {
      route.schema = undefined;
      route.handler = async () => { throw new Error('Unprotected privileged handler reached'); };
    }
  });
  await app.register(routes, { prefix: '/api' });
  await app.ready();
  const exceptions = new Set(['/api/admin/nitter/session']);
  for (const route of inventory.filter(r => r.url.startsWith('/api/admin/'))) {
    assert.ok(route.protected || exceptions.has(route.url), `${route.method} ${route.url} has no administrator guard`);
  }
  const publicMutations = new Set([
    'POST /api/auth/login', 'POST /api/auth/google',
    'POST /api/schedules/suggestions/save', 'POST /api/push/register', 'DELETE /api/push/register',
    'POST /api/push/ops-alert', 'PUT /api/admin/nitter/session',
  ]);
  for (const r of inventory.filter(r => !r.protected && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.method))) {
    assert.ok(publicMutations.has(`${r.method} ${r.url}`), `Mutation without explicit access policy: ${r.method} ${r.url}`);
  }
  const protectedRoutes = inventory.filter(r => r.protected);
  assert.ok(protectedRoutes.length > 100);
  for (const route of protectedRoutes) {
    const methods = [route.method].flat();
    for (const method of methods) {
      const url = route.url.replace(/:[^/]+/g, '1');
      for (const headers of [{}, { authorization: 'Bearer malformed-test-token' }]) {
        const result = await app.inject({ method, url, headers });
        assert.equal(result.statusCode, 401, `${method} ${url}`);
      }
    }
  }
  assert.equal((await app.inject('/api/admin/nitter/session')).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/push/ops-alert', payload: { title: 'isolated', body: 'not sent' } })).statusCode, 401);
  console.log(`Verified ${protectedRoutes.length} privileged routes, plus separate-key endpoints (no external writes)`);
});
