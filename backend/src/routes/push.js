/**
 * 푸시 알림 라우트
 * - POST /push/register    : 앱 기기 토큰 등록·갱신 (앱에서 호출)
 * - DELETE /push/register  : 토큰 해제
 * - POST /push/ops-alert   : 운영 알림 발송 (내부 스크립트 전용, X-Internal-Key)
 * - POST /push/test        : 테스트 발송 (관리자 인증)
 */
import { errorResponse } from '../schemas/index.js';
import { badRequest, unauthorized, serverError } from '../utils/error.js';
import { sendOpsAlert, isPushAvailable, getPushInitError } from '../services/push.js';

export default async function pushRoutes(fastify) {
  const { db } = fastify;

  /**
   * POST /api/push/register — 기기 토큰 등록 (앱 실행 시)
   * adminKey가 일치하면 운영 알림 수신 기기로 표시
   */
  fastify.post('/register', {
    schema: {
      tags: ['push'],
      summary: 'FCM 기기 토큰 등록',
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', minLength: 10, maxLength: 255 },
          platform: { type: 'string', enum: ['android', 'ios'], default: 'android' },
          adminKey: { type: 'string' },
        },
        required: ['token'],
      },
      response: { 200: { type: 'object', additionalProperties: true }, 400: errorResponse },
    },
  }, async (request, reply) => {
    const { token, platform = 'android', adminKey } = request.body;
    if (!token?.trim()) return badRequest(reply, '토큰이 필요합니다.');

    const isAdmin =
      adminKey && process.env.PUSH_ADMIN_KEY && adminKey === process.env.PUSH_ADMIN_KEY ? 1 : 0;

    await db.query(
      `INSERT INTO device_tokens (token, platform, is_admin)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         platform = VALUES(platform),
         is_admin = GREATEST(is_admin, VALUES(is_admin)),
         last_seen_at = CURRENT_TIMESTAMP`,
      [token.trim(), platform, isAdmin]
    );

    return { success: true, isAdmin: isAdmin === 1 };
  });

  /**
   * DELETE /api/push/register — 토큰 해제
   */
  fastify.delete('/register', {
    schema: {
      tags: ['push'],
      summary: 'FCM 기기 토큰 해제',
      body: {
        type: 'object',
        properties: { token: { type: 'string' } },
        required: ['token'],
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request) => {
    await db.query('DELETE FROM device_tokens WHERE token = ?', [request.body.token]);
    return { success: true };
  });

  /**
   * POST /api/push/ops-alert — 운영 알림 발송 (내부 스크립트 전용)
   */
  fastify.post('/ops-alert', {
    schema: {
      tags: ['push'],
      summary: '운영 알림 발송 (내부용)',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 100 },
          body: { type: 'string', minLength: 1, maxLength: 500 },
          data: { type: 'object', additionalProperties: true },
        },
        required: ['title', 'body'],
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        403: errorResponse,
      },
    },
  }, async (request, reply) => {
    const key = request.headers['x-internal-key'];
    if (!process.env.PUSH_INTERNAL_KEY || key !== process.env.PUSH_INTERNAL_KEY) {
      return unauthorized(reply, '내부 키가 유효하지 않습니다.');
    }

    try {
      const result = await sendOpsAlert(db, {
        title: request.body.title,
        body: request.body.body,
        data: request.body.data || {},
      });
      fastify.log.info(`[push] 운영 알림 발송: ${request.body.title} → ${JSON.stringify(result)}`);
      return { success: true, ...result };
    } catch (err) {
      fastify.log.error(`[push] 발송 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * POST /api/push/test — 테스트 발송 (관리자 인증)
   */
  fastify.post('/test', {
    schema: {
      tags: ['push'],
      summary: '푸시 테스트 발송',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', default: 'fromis_9 테스트' },
          body: { type: 'string', default: '푸시 알림이 정상 동작합니다.' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const [[{ n }]] = await db.query(
      'SELECT COUNT(*) n FROM device_tokens WHERE is_admin = 1'
    );
    const result = await sendOpsAlert(db, {
      title: request.body?.title || 'fromis_9 테스트',
      body: request.body?.body || '푸시 알림이 정상 동작합니다.',
    });
    return {
      success: true,
      adminDevices: n,
      pushAvailable: isPushAvailable(),
      initError: getPushInitError(),
      ...result,
    };
  });
}
