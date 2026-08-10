import fp from 'fastify-plugin';
import Redis from 'ioredis';

async function redisPlugin(fastify, opts) {
  const redis = new Redis({
    host: fastify.config.redis.host,
    port: fastify.config.redis.port,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    fastify.log.info('Redis 연결 성공');
  } catch (err) {
    fastify.log.error('Redis 연결 실패:', err.message);
    throw err;
  }

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
    fastify.log.info('Redis 연결 종료');
  });
}

export default fp(redisPlugin, { name: 'redis' });
