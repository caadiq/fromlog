import { errorResponse } from '../../schemas/index.js';
import { serverError } from '../../utils/error.js';

/**
 * 활동 로그 관리자 라우트
 */
export default async function logsRoutes(fastify) {
  const { db } = fastify;

  /**
   * GET /api/admin/logs/categories
   * 로그에 존재하는 카테고리 목록 조회
   */
  fastify.get('/categories', {
    schema: {
      tags: ['admin/logs'],
      summary: '로그 카테고리 목록 조회',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const [rows] = await db.query('SELECT DISTINCT category FROM logs ORDER BY category');
      return { categories: rows.map(r => r.category) };
    } catch (err) {
      fastify.log.error(`로그 카테고리 조회 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * GET /api/admin/logs
   * 활동 로그 목록 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['admin/logs'],
      summary: '활동 로그 목록 조회',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          category: { type: 'string', description: '카테고리 필터 (콤마 구분)' },
          actor: { type: 'string', description: '행위자 필터 (admin 또는 bot)' },
          search: { type: 'string', description: 'summary 검색' },
          from: { type: 'string', description: '시작 날짜 (YYYY-MM-DD)' },
          to: { type: 'string', description: '종료 날짜 (YYYY-MM-DD)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            logs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  actor: { type: 'string' },
                  action: { type: 'string' },
                  category: { type: 'string' },
                  target_type: { type: 'string', nullable: true },
                  target_id: { type: 'integer', nullable: true },
                  summary: { type: 'string' },
                  details: { type: 'object', nullable: true, additionalProperties: true },
                  created_at: { type: 'string' },
                },
              },
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { page = 1, limit = 50, category, actor, search, from, to } = request.query;

    try {
      const conditions = [];
      const params = [];

      // 카테고리 필터
      if (category) {
        const categories = category.split(',').map(c => c.trim()).filter(Boolean);
        if (categories.length > 0) {
          conditions.push(`category IN (${categories.map(() => '?').join(',')})`);
          params.push(...categories);
        }
      }

      // 행위자 필터
      if (actor === 'admin') {
        conditions.push("actor = 'admin'");
      } else if (actor === 'bot') {
        conditions.push("actor != 'admin'");
      }

      // 텍스트 검색
      if (search) {
        conditions.push('summary LIKE ?');
        params.push(`%${search}%`);
      }

      // 날짜 필터
      if (from) {
        conditions.push('created_at >= ?');
        params.push(`${from} 00:00:00`);
      }
      if (to) {
        conditions.push('created_at <= ?');
        params.push(`${to} 23:59:59`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      // 총 개수 조회
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM logs ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // 로그 조회
      const [logs] = await db.query(
        `SELECT * FROM logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      // details는 longtext(JSON 문자열)로 저장되어 있으므로 객체로 파싱
      const parsedLogs = logs.map(log => {
        if (!log.details) return log;
        if (typeof log.details === 'object') return log;
        try {
          return { ...log, details: JSON.parse(log.details) };
        } catch {
          return { ...log, details: { raw: log.details } };
        }
      });

      return {
        logs: parsedLogs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (err) {
      fastify.log.error(`활동 로그 조회 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });
}
