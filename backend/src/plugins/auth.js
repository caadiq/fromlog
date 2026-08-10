import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import config from '../config/index.js';

async function authPlugin(fastify, opts) {
  // JWT 플러그인 등록
  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // 인증 데코레이터
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: '인증이 필요합니다.' });
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
});
