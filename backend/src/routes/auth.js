import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { badRequest, unauthorized, serverError } from '../utils/error.js';
import config from '../config/index.js';

/** 구글 ID 토큰 검증기 (클라이언트 ID 미설정이면 null → 구글 로그인 비활성) */
const googleClient = config.google.oauthClientId
  ? new OAuth2Client(config.google.oauthClientId)
  : null;

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
   * GET /api/auth/config
   * 로그인 화면이 구글 버튼을 띄울지 판단할 공개 설정.
   * clientId는 원래 공개값이라 그대로 내려도 된다(허용 이메일은 내리지 않는다).
   */
  fastify.get('/config', async () => ({
    googleEnabled: Boolean(googleClient && config.google.adminEmails.length > 0),
    googleClientId: config.google.oauthClientId || '',
  }));

  /**
   * POST /api/auth/google
   * 구글 계정으로 관리자 로그인.
   *
   * 프론트에서 받은 구글 ID 토큰을 검증하고, 허용 목록(ADMIN_GOOGLE_EMAILS)에 있는
   * 이메일이면 기존 비밀번호 로그인과 똑같은 JWT를 발급한다.
   * 비밀번호 로그인은 그대로 남겨둔다 — 구글이 막히거나 설정이 깨졌을 때 잠기지 않도록.
   */
  fastify.post('/google', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        continueExceeding: true,
        keyGenerator: (request) => request.ip,
      },
    },
  }, async (request, reply) => {
    if (!googleClient || config.google.adminEmails.length === 0) {
      return badRequest(reply, '구글 로그인이 설정되지 않았습니다.');
    }

    const { credential } = request.body || {};
    if (!credential) {
      return badRequest(reply, '구글 인증 정보가 없습니다.');
    }

    let email;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.oauthClientId,
      });
      const payload = ticket.getPayload();
      // 이메일 소유가 확인된 계정만 인정 (email_verified 없으면 거부)
      if (!payload?.email || !payload.email_verified) {
        return unauthorized(reply, '이메일이 확인되지 않은 구글 계정입니다.');
      }
      email = payload.email.toLowerCase();
    } catch (err) {
      fastify.log.warn({ err }, '[auth] 구글 ID 토큰 검증 실패');
      return unauthorized(reply, '구글 인증에 실패했습니다.');
    }

    if (!config.google.adminEmails.includes(email)) {
      fastify.log.warn(`[auth] 허용되지 않은 구글 계정 로그인 시도: ${email}`);
      return unauthorized(reply, '이 계정은 관리자로 등록되어 있지 않습니다.');
    }

    try {
      const [users] = await fastify.db.query(
        'SELECT * FROM admin_users ORDER BY id LIMIT 1'
      );
      if (users.length === 0) {
        return serverError(reply, '관리자 계정이 없습니다.');
      }
      const user = users[0];
      const token = fastify.jwt.sign({ id: user.id, username: user.username });
      fastify.log.info(`[auth] 구글 로그인 성공: ${email}`);
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
