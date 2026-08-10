import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

/**
 * 일정 카테고리 관리자 라우트
 * (Express → Fastify 마이그레이션 때 누락됐던 쓰기 라우트 복원)
 */
export default async function scheduleCategoriesRoutes(fastify) {
  const { db } = fastify;

  /**
   * POST /api/admin/schedule-categories
   * 카테고리 생성
   */
  fastify.post('/schedule-categories', {
    schema: {
      tags: ['admin/schedule-categories'],
      summary: '카테고리 생성',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'color'],
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            id: { type: 'integer' },
            sort_order: { type: 'integer' },
          },
        },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { name, color } = request.body;

    // 현재 최대 sort_order 뒤에 추가
    const [maxOrder] = await db.query('SELECT MAX(sort_order) as maxOrder FROM schedule_categories');
    const nextOrder = (maxOrder[0].maxOrder || 0) + 1;

    const [result] = await db.query(
      'INSERT INTO schedule_categories (name, color, sort_order) VALUES (?, ?, ?)',
      [name, color, nextOrder]
    );

    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'schedule_category', targetId: result.insertId,
      summary: `카테고리 생성: ${name}`,
    });

    return { message: '카테고리가 생성되었습니다.', id: result.insertId, sort_order: nextOrder };
  });

  /**
   * PUT /api/admin/schedule-categories/:id
   * 카테고리 수정
   */
  fastify.put('/schedule-categories/:id', {
    schema: {
      tags: ['admin/schedule-categories'],
      summary: '카테고리 수정',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string' },
          sort_order: { type: 'integer' },
        },
      },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, color, sort_order } = request.body;

    const [existing] = await db.query('SELECT * FROM schedule_categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, '카테고리를 찾을 수 없습니다.');
    }

    await db.query(
      'UPDATE schedule_categories SET name = ?, color = ?, sort_order = ? WHERE id = ?',
      [
        name || existing[0].name,
        color || existing[0].color,
        sort_order !== undefined ? sort_order : existing[0].sort_order,
        id,
      ]
    );

    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'schedule_category', targetId: parseInt(id),
      summary: `카테고리 수정: ${name || existing[0].name}`,
    });

    return { message: '카테고리가 수정되었습니다.' };
  });

  /**
   * DELETE /api/admin/schedule-categories/:id
   * 카테고리 삭제 (기본 카테고리·사용 중인 카테고리는 불가)
   */
  fastify.delete('/schedule-categories/:id', {
    schema: {
      tags: ['admin/schedule-categories'],
      summary: '카테고리 삭제',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        400: errorResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.query('SELECT * FROM schedule_categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, '카테고리를 찾을 수 없습니다.');
    }

    // 기본 카테고리는 삭제 불가
    if (existing[0].is_default === 1) {
      return badRequest(reply, '기본 카테고리는 삭제할 수 없습니다.');
    }

    // 사용 중인 카테고리는 삭제 불가
    const [used] = await db.query('SELECT COUNT(*) as count FROM schedules WHERE category_id = ?', [id]);
    if (used[0].count > 0) {
      return badRequest(reply, `해당 카테고리를 사용하는 일정이 ${used[0].count}개 있어 삭제할 수 없습니다.`);
    }

    await db.query('DELETE FROM schedule_categories WHERE id = ?', [id]);

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'schedule',
      targetType: 'schedule_category', targetId: parseInt(id),
      summary: `카테고리 삭제: ${existing[0].name}`,
    });

    return { message: '카테고리가 삭제되었습니다.' };
  });

  /**
   * PUT /api/admin/schedule-categories-order
   * 카테고리 순서 일괄 업데이트
   */
  fastify.put('/schedule-categories-order', {
    schema: {
      tags: ['admin/schedule-categories'],
      summary: '카테고리 순서 일괄 변경',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['orders'],
        properties: {
          orders: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'sort_order'],
              properties: {
                id: { type: 'integer' },
                sort_order: { type: 'integer' },
              },
            },
          },
        },
      },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { orders } = request.body;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of orders) {
        await conn.query('UPDATE schedule_categories SET sort_order = ? WHERE id = ?', [
          item.sort_order,
          item.id,
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'schedule_category', targetId: 0,
      summary: `카테고리 순서 변경 (${orders.length}개)`,
    });

    return { message: '순서가 업데이트되었습니다.' };
  });
}
