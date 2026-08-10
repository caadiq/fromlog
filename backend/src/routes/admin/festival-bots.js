import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

/**
 * 축제 봇 응답 스키마
 */
const festivalBotResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    search_url: { type: 'string' },
    cron_interval: { type: 'integer' },
    enabled: { type: 'boolean' },
  },
};

const festivalBotIdParam = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: '축제 봇 DB ID' },
  },
  required: ['id'],
};

/**
 * DB row → API 응답 형식
 */
function formatBotResponse(row) {
  return {
    id: row.id,
    name: row.name,
    search_url: row.search_url,
    cron_interval: row.cron_interval,
    enabled: row.enabled === 1,
  };
}

/**
 * 축제 봇 관리 라우트
 */
export default async function festivalBotsRoutes(fastify) {
  const { db, scheduler } = fastify;

  /**
   * GET /api/admin/festival-bots
   * 축제 봇 목록 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['admin/festival-bots'],
      summary: '축제 봇 목록 조회',
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'array', items: festivalBotResponse } },
    },
    preHandler: [fastify.authenticate],
  }, async () => {
    const [rows] = await db.query('SELECT * FROM bot_festival ORDER BY id');
    return rows.map(formatBotResponse);
  });

  /**
   * GET /api/admin/festival-bots/:id
   * 축제 봇 상세 조회
   */
  fastify.get('/:id', {
    schema: {
      tags: ['admin/festival-bots'],
      summary: '축제 봇 상세 조회',
      security: [{ bearerAuth: [] }],
      params: festivalBotIdParam,
      response: { 200: festivalBotResponse, 404: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await db.query('SELECT * FROM bot_festival WHERE id = ?', [id]);
    if (rows.length === 0) {
      return notFound(reply, '축제 봇을 찾을 수 없습니다.');
    }
    return formatBotResponse(rows[0]);
  });

  /**
   * POST /api/admin/festival-bots
   * 축제 봇 추가
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/festival-bots'],
      summary: '축제 봇 추가',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          search_url: { type: 'string' },
          cron_interval: { type: 'integer', default: 360 },
        },
        required: ['name', 'search_url'],
      },
      response: { 201: festivalBotResponse, 400: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { name, search_url, cron_interval = 360 } = request.body;

    if (!name?.trim() || !search_url?.trim()) {
      return badRequest(reply, '이름과 크롤링 URL은 필수입니다.');
    }

    const [result] = await db.query(
      `INSERT INTO bot_festival (name, search_url, cron_interval, enabled)
       VALUES (?, ?, ?, 1)`,
      [name.trim(), search_url.trim(), cron_interval]
    );

    scheduler.invalidateCache();
    const botId = `festival-${result.insertId}`;

    // 봇 시작 (스케줄러 등록)
    try {
      await scheduler.startBot(botId);
    } catch (err) {
      fastify.log.error(`[${botId}] 봇 시작 실패: ${err.message}`);
    }

    const [newBot] = await db.query('SELECT * FROM bot_festival WHERE id = ?', [result.insertId]);
    logActivity(db, {
      actor: 'admin', action: 'create', category: 'bot',
      targetType: 'festival_bot', targetId: result.insertId,
      summary: `축제 봇 생성: ${name.trim()}`,
    });
    reply.code(201);
    return formatBotResponse(newBot[0]);
  });

  /**
   * PUT /api/admin/festival-bots/:id
   * 축제 봇 수정
   */
  fastify.put('/:id', {
    schema: {
      tags: ['admin/festival-bots'],
      summary: '축제 봇 수정',
      security: [{ bearerAuth: [] }],
      params: festivalBotIdParam,
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          search_url: { type: 'string' },
          cron_interval: { type: 'integer' },
          enabled: { type: 'boolean' },
        },
      },
      response: { 200: festivalBotResponse, 404: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const [existing] = await db.query('SELECT * FROM bot_festival WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, '축제 봇을 찾을 수 없습니다.');
    }

    const fields = [];
    const values = [];
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.search_url !== undefined) {
      fields.push('search_url = ?');
      values.push(updates.search_url);
    }
    if (updates.cron_interval !== undefined) {
      fields.push('cron_interval = ?');
      values.push(updates.cron_interval);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      await db.query(`UPDATE bot_festival SET ${fields.join(', ')} WHERE id = ?`, values);

      // 스케줄러 캐시 무효화 및 봇 재시작
      scheduler.invalidateCache();
      const botId = `festival-${id}`;
      const shouldBeEnabled = updates.enabled !== undefined
        ? updates.enabled
        : existing[0].enabled === 1;
      try {
        await scheduler.stopBot(botId);
        if (shouldBeEnabled) {
          // 설정 반영용 재시작 — 즉시 동기화(크롤링)는 생략해 응답 블로킹 방지
          await scheduler.startBot(botId, { runImmediately: false });
        }
      } catch (err) {
        fastify.log.error(`[${botId}] 봇 재시작 실패: ${err.message}`);
      }
    }

    const [updated] = await db.query('SELECT * FROM bot_festival WHERE id = ?', [id]);
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'bot',
      targetType: 'festival_bot', targetId: parseInt(id),
      summary: `축제 봇 수정: ${existing[0].name}`,
    });
    return formatBotResponse(updated[0]);
  });

  /**
   * DELETE /api/admin/festival-bots/:id
   * 축제 봇 삭제
   */
  fastify.delete('/:id', {
    schema: {
      tags: ['admin/festival-bots'],
      summary: '축제 봇 삭제',
      security: [{ bearerAuth: [] }],
      params: festivalBotIdParam,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.query('SELECT * FROM bot_festival WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, '축제 봇을 찾을 수 없습니다.');
    }

    const botId = `festival-${id}`;
    try {
      await scheduler.stopBot(botId);
    } catch (err) {
      // 이미 정지된 경우 무시
    }

    await db.query('DELETE FROM bot_festival WHERE id = ?', [id]);
    scheduler.invalidateCache();

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'bot',
      targetType: 'festival_bot', targetId: parseInt(id),
      summary: `축제 봇 삭제: ${existing[0].name}`,
    });
    return { success: true };
  });
}
