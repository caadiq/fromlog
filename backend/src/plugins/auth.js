import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import config from '../config/index.js';
import { authTokenHash } from '../utils/authSession.js';

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
    const { id, username, exp } = request.user;
    if (!Number.isInteger(id) || typeof username !== 'string' || !Number.isFinite(exp)) {
      return reply.status(401).send({ error: '인증이 필요합니다.' });
    }
    try {
      const [users] = await fastify.db.query('SELECT id, username FROM admin_users WHERE id = ?', [id]);
      if (!users.length || users[0].username !== username) {
        return reply.status(401).send({ error: '유효하지 않은 관리자 계정입니다.' });
      }
      const [revoked] = await fastify.db.query(
        'SELECT token_hash FROM revoked_admin_tokens WHERE token_hash = ? AND expires_at > NOW()',
        [authTokenHash(request)]
      );
      if (revoked.length) return reply.status(401).send({ error: '로그아웃된 세션입니다.' });
    } catch (err) {
      fastify.log.error({ err }, '[auth] session lookup failed');
      return reply.status(503).send({ error: '로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' });
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
});
