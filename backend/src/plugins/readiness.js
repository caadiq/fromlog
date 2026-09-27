import fp from 'fastify-plugin';
import { withDeadline } from '../utils/deadline.js';

export default fp(async function readiness(fastify, { timeoutMs = 2000 } = {}) {
  let pending;
  let cached;
  let checkedAt = 0;
  async function check() {
    const probes = {
      database: () => fastify.db.query({ sql: 'SELECT 1', timeout: timeoutMs }),
      redis: () => fastify.redis.ping(),
      search: () => fastify.meilisearch.health(),
    };
    const checks = Object.fromEntries(await Promise.all(Object.entries(probes).map(async ([name, probe]) => {
      try { await withDeadline(probe, timeoutMs); return [name, 'ok']; }
      catch { return [name, 'unavailable']; }
    })));
    cached = { status: Object.values(checks).every(value => value === 'ok') ? 'ok' : 'degraded', checks };
    checkedAt = Date.now();
    return cached;
  }
  fastify.get('/api/ready', async (request, reply) => {
    if (!cached || Date.now() - checkedAt >= 5000) {
      if (!pending) pending = check().finally(() => { pending = null; });
      await pending;
    }
    reply.header('Cache-Control', 'no-store');
    return reply.code(cached.status === 'ok' ? 200 : 503).send(cached);
  });
});
