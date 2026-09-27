import fp from 'fastify-plugin';
import Redis from 'ioredis';

async function redisPlugin(fastify, opts) {
  const redis = new Redis({
    host: fastify.config.redis.host,
    port: fastify.config.redis.port,
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.on('error', err => fastify.log.warn({ code: err.code }, 'Redis unavailable; reconnecting'));
  try {
    await redis.connect();
    fastify.log.info('Redis 연결 성공');
  } catch (err) {
    fastify.log.error('Redis 연결 실패:', err.message);
    // Keep DB-backed routes available while ioredis reconnects.
  }

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    try { if (redis.status === 'ready') await redis.quit(); }
    finally { redis.disconnect(); }
    fastify.log.info('Redis 연결 종료');
  });
}

export default fp(redisPlugin, { name: 'redis' });
