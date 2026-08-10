import bcrypt from 'bcrypt';
import { badRequest, unauthorized, serverError } from '../utils/error.js';

/**
 * 인증 라우트
 * /api/auth/*
 */
export default async function authRoutes(fastify, opts) {
  /**
   * POST /api/auth/login
   * 관리자 로그인
   */
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
        continueExceeding: true, // 차단 중 시도하면 타이머 리셋 (마지막 시도 기준 1분)
        keyGenerator: (request) => request.ip,
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
        }),
      },
    },
    schema: {
      tags: ['auth'],
      summary: '관리자 로그인',
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', description: '관리자 아이디' },
          password: { type: 'string', description: '비밀번호' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
              },
            },
          },
        },
        429: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return badRequest(reply, '아이디와 비밀번호를 입력해주세요.');
    }

    try {
      const [users] = await fastify.db.query(
        'SELECT * FROM admin_users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        return unauthorized(reply, '아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      const user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return unauthorized(reply, '아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      // JWT 토큰 생성
      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
      });

      return {
        message: '로그인 성공',
        token,
        user: { id: user.id, username: user.username },
      };
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '로그인 처리 중 오류가 발생했습니다.');
    }
  });

  /**
   * GET /api/auth/verify
   * 토큰 검증
   */
  fastify.get('/verify', {
    schema: {
      tags: ['auth'],
      summary: '토큰 검증',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    return { valid: true, user: request.user };
  });
}
