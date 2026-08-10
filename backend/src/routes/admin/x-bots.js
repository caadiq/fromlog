import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound, serverError } from '../../utils/error.js';
import { fetchProfile } from '../../services/x/scraper.js';
import { logActivity } from '../../utils/log.js';

/**
 * X 봇 스키마
 */
const xBotResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    username: { type: 'string' },
    display_name: { type: 'string' },
    avatar_url: { type: 'string' },
    text_filters: { type: 'array', items: { type: 'string' } },
    include_retweets: { type: 'boolean' },
    extract_youtube: { type: 'boolean' },
    exclude_managed_channels: { type: 'boolean' },
    cron_interval: { type: 'integer' },
    enabled: { type: 'boolean' },
  },
};

const xBotIdParam = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'X 봇 DB ID' },
  },
  required: ['id'],
};

/**
 * DB row를 API 응답 형식으로 변환
 */
function formatBotResponse(row) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    text_filters: row.text_filters
      ? (typeof row.text_filters === 'string'
          ? JSON.parse(row.text_filters)
          : row.text_filters)
      : [],
    include_retweets: row.include_retweets === 1,
    extract_youtube: row.extract_youtube === 1,
    exclude_managed_channels: row.exclude_managed_channels === 1,
    cron_interval: row.cron_interval,
    enabled: row.enabled === 1,
  };
}

/**
 * X 봇 관리 라우트
 */
export default async function xBotsRoutes(fastify) {
  const { db, scheduler } = fastify;
  const nitterUrl = process.env.NITTER_URL || 'http://nitter:8080';

  /**
   * POST /api/admin/x-bots/lookup
   * username으로 프로필 정보 조회
   */
  fastify.post('/lookup', {
    schema: {
      tags: ['admin/x-bots'],
      summary: 'X username으로 프로필 정보 조회',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'X username (@ 없이)' },
        },
        required: ['username'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            displayName: { type: 'string' },
            avatarUrl: { type: 'string' },
          },
        },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { username } = request.body;

    try {
      const profile = await fetchProfile(nitterUrl, username);
      return profile;
    } catch (err) {
      return badRequest(reply, err.message);
    }
  });

  /**
   * GET /api/admin/x-bots
   * X 봇 목록 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['admin/x-bots'],
      summary: 'X 봇 목록 조회',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: xBotResponse,
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const [rows] = await db.query('SELECT * FROM bot_x ORDER BY id');
    return rows.map(formatBotResponse);
  });

  /**
   * GET /api/admin/x-bots/:id
   * X 봇 상세 조회
   */
  fastify.get('/:id', {
    schema: {
      tags: ['admin/x-bots'],
      summary: 'X 봇 상세 조회',
      security: [{ bearerAuth: [] }],
      params: xBotIdParam,
      response: {
        200: xBotResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await db.query('SELECT * FROM bot_x WHERE id = ?', [id]);

    if (rows.length === 0) {
      return notFound(reply, 'X 봇을 찾을 수 없습니다.');
    }

    return formatBotResponse(rows[0]);
  });

  /**
   * POST /api/admin/x-bots
   * X 봇 추가
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/x-bots'],
      summary: 'X 봇 추가',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          display_name: { type: ['string', 'null'] },
          avatar_url: { type: ['string', 'null'] },
          text_filters: { type: ['array', 'null'], items: { type: 'string' } },
          include_retweets: { type: 'boolean', default: false },
          extract_youtube: { type: 'boolean', default: false },
          exclude_managed_channels: { type: 'boolean', default: true },
          cron_interval: { type: 'integer', default: 1 },
        },
        required: ['username'],
      },
      response: {
        201: xBotResponse,
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const {
      username,
      display_name,
      avatar_url,
      text_filters,
      include_retweets = false,
      extract_youtube = false,
      exclude_managed_channels = true,
      cron_interval = 1,
    } = request.body;

    // 중복 체크
    const [existing] = await db.query(
      'SELECT id FROM bot_x WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return badRequest(reply, '이미 등록된 X 계정입니다.');
    }

    const [result] = await db.query(
      `INSERT INTO bot_x (username, display_name, avatar_url, text_filters, include_retweets, extract_youtube, exclude_managed_channels, cron_interval, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        username,
        display_name || null,
        avatar_url || null,
        text_filters && text_filters.length > 0 ? JSON.stringify(text_filters) : null,
        include_retweets ? 1 : 0,
        extract_youtube ? 1 : 0,
        exclude_managed_channels ? 1 : 0,
        cron_interval,
      ]
    );

    // 스케줄러 캐시 무효화
    scheduler.invalidateCache();
    const botId = `x-${result.insertId}`;

    // 전체 트윗 동기화 수행 (백그라운드)
    const bot = {
      id: botId,
      dbId: result.insertId,
      type: 'x',
      username,
      nitterUrl: process.env.NITTER_URL || 'http://nitter:8080',
      textFilters: text_filters || [],
      includeRetweets: include_retweets,
      extractYoutube: extract_youtube,
      excludeManagedChannels: exclude_managed_channels,
    };

    // 전체 동기화 (async, 응답 대기하지 않음)
    fastify.xBot.syncAllTweets(bot)
      .then((syncResult) => {
        fastify.log.info(`[${botId}] 초기 전체 동기화 완료: ${syncResult.addedCount}개 추가`);
      })
      .catch((err) => {
        fastify.log.error(`[${botId}] 초기 전체 동기화 실패:`, err);
      });

    // 봇 시작 (스케줄러 등록)
    try {
      await scheduler.startBot(botId);
    } catch (err) {
      fastify.log.error(`[${botId}] 봇 시작 실패:`, err);
    }

    const [newBot] = await db.query('SELECT * FROM bot_x WHERE id = ?', [result.insertId]);
    reply.code(201);
    logActivity(db, { actor: 'admin', action: 'create', category: 'bot', targetType: 'x_bot', targetId: result.insertId, summary: `X 봇 생성: ${username}` });
    return formatBotResponse(newBot[0]);
  });

  /**
   * PUT /api/admin/x-bots/:id
   * X 봇 수정
   */
  fastify.put('/:id', {
    schema: {
      tags: ['admin/x-bots'],
      summary: 'X 봇 수정',
      security: [{ bearerAuth: [] }],
      params: xBotIdParam,
      body: {
        type: 'object',
        properties: {
          display_name: { type: ['string', 'null'] },
          avatar_url: { type: ['string', 'null'] },
          text_filters: { type: ['array', 'null'], items: { type: 'string' } },
          include_retweets: { type: 'boolean' },
          extract_youtube: { type: 'boolean' },
          exclude_managed_channels: { type: 'boolean' },
          cron_interval: { type: 'integer' },
          enabled: { type: 'boolean' },
        },
      },
      response: {
        200: xBotResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    // 존재 확인
    const [existing] = await db.query('SELECT * FROM bot_x WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, 'X 봇을 찾을 수 없습니다.');
    }

    // 동적 업데이트 쿼리 생성
    const fields = [];
    const values = [];

    if (updates.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(updates.display_name);
    }
    if (updates.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(updates.avatar_url);
    }
    if (updates.text_filters !== undefined) {
      fields.push('text_filters = ?');
      values.push(updates.text_filters && updates.text_filters.length > 0
        ? JSON.stringify(updates.text_filters)
        : null);
    }
    if (updates.include_retweets !== undefined) {
      fields.push('include_retweets = ?');
      values.push(updates.include_retweets ? 1 : 0);
    }
    if (updates.extract_youtube !== undefined) {
      fields.push('extract_youtube = ?');
      values.push(updates.extract_youtube ? 1 : 0);
    }
    if (updates.exclude_managed_channels !== undefined) {
      fields.push('exclude_managed_channels = ?');
      values.push(updates.exclude_managed_channels ? 1 : 0);
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
      await db.query(
        `UPDATE bot_x SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // 스케줄러 캐시 무효화 및 봇 재시작
      scheduler.invalidateCache();
      const botId = `x-${id}`;
      const shouldBeEnabled = updates.enabled !== undefined
        ? updates.enabled
        : existing[0].enabled === 1;
      try {
        await scheduler.stopBot(botId);
        if (shouldBeEnabled) {
          // 설정 반영용 재시작 — 즉시 동기화는 생략해 응답 블로킹 방지
          await scheduler.startBot(botId, { runImmediately: false });
        }
      } catch (err) {
        fastify.log.error(`[${botId}] 봇 재시작 실패:`, err);
      }
    }

    const [updatedBot] = await db.query('SELECT * FROM bot_x WHERE id = ?', [id]);
    logActivity(db, { actor: 'admin', action: 'update', category: 'bot', targetType: 'x_bot', targetId: parseInt(id), summary: `X 봇 수정: ${existing[0].username}` });
    return formatBotResponse(updatedBot[0]);
  });

  /**
   * DELETE /api/admin/x-bots/:id
   * X 봇 삭제
   */
  fastify.delete('/:id', {
    schema: {
      tags: ['admin/x-bots'],
      summary: 'X 봇 삭제',
      security: [{ bearerAuth: [] }],
      params: xBotIdParam,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    // 존재 확인
    const [existing] = await db.query('SELECT * FROM bot_x WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, 'X 봇을 찾을 수 없습니다.');
    }

    // 봇 정지
    const botId = `x-${id}`;
    try {
      await scheduler.stopBot(botId);
    } catch (err) {
      // 이미 정지된 경우 무시
    }

    // DB에서 삭제
    await db.query('DELETE FROM bot_x WHERE id = ?', [id]);

    // 스케줄러 캐시 무효화
    scheduler.invalidateCache();

    logActivity(db, { actor: 'admin', action: 'delete', category: 'bot', targetType: 'x_bot', targetId: parseInt(id), summary: `X 봇 삭제: ${existing[0].username}` });
    return { success: true };
  });
}
