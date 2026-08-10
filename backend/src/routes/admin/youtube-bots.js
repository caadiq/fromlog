import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound, serverError } from '../../utils/error.js';
import { getChannelByHandle } from '../../services/youtube/api.js';
import { logActivity } from '../../utils/log.js';
import { parseJsonColumn } from '../../utils/json.js';

/**
 * YouTube 봇 스키마
 */
const youtubeBotResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    channel_id: { type: 'string' },
    channel_handle: { type: 'string' },
    channel_name: { type: 'string' },
    banner_url: { type: 'string' },
    cron_interval: { type: ['integer', 'null'] },
    enabled: { type: 'boolean' },
    title_filters: { type: 'array', items: { type: 'string' } },
    exclude_shorts: { type: 'boolean' },
    archive_shorts: { type: 'boolean' },
    auto_schedule_config: { type: ['object', 'null'], additionalProperties: true },
    weekly_schedule_config: { type: ['object', 'null'], additionalProperties: true },
    video_category: { type: 'string', enum: ['official', 'sp', 'variety', 'music'] },
    add_to_schedule: { type: 'boolean' },
  },
};

const youtubeBotIdParam = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'YouTube 봇 DB ID' },
  },
  required: ['id'],
};

/**
 * DB row를 API 응답 형식으로 변환
 */
function formatBotResponse(row) {
  return {
    id: row.id,
    channel_id: row.channel_id,
    channel_handle: row.channel_handle,
    channel_name: row.channel_name,
    banner_url: row.banner_url,
    cron_interval: row.cron_interval,
    enabled: row.enabled === 1,
    title_filters: parseJsonColumn(row.title_filters, []),
    exclude_shorts: row.exclude_shorts === 1,
    archive_shorts: row.archive_shorts !== 0,
    video_category: row.video_category || 'variety',
    add_to_schedule: row.add_to_schedule !== 0,
    auto_schedule_config: parseJsonColumn(row.auto_schedule_config, null),
    weekly_schedule_config: parseJsonColumn(row.weekly_schedule_config, null),
  };
}

/**
 * YouTube 봇 관리 라우트
 */
export default async function youtubeBotsRoutes(fastify) {
  const { db, scheduler } = fastify;

  /**
   * POST /api/admin/youtube-bots/lookup
   * 채널 핸들로 채널 정보 조회
   */
  fastify.post('/lookup', {
    schema: {
      tags: ['admin/youtube-bots'],
      summary: '채널 핸들로 채널 정보 조회',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: '@username 형식' },
        },
        required: ['handle'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
            handle: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            thumbnailUrl: { type: 'string' },
            bannerUrl: { type: 'string' },
          },
        },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { handle } = request.body;

    try {
      const channelInfo = await getChannelByHandle(handle);
      return channelInfo;
    } catch (err) {
      return badRequest(reply, err.message);
    }
  });

  /**
   * GET /api/admin/youtube-bots
   * YouTube 봇 목록 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['admin/youtube-bots'],
      summary: 'YouTube 봇 목록 조회',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: youtubeBotResponse,
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const [rows] = await db.query('SELECT * FROM bot_youtube ORDER BY id');
    return rows.map(formatBotResponse);
  });

  /**
   * GET /api/admin/youtube-bots/:id
   * YouTube 봇 상세 조회
   */
  fastify.get('/:id', {
    schema: {
      tags: ['admin/youtube-bots'],
      summary: 'YouTube 봇 상세 조회',
      security: [{ bearerAuth: [] }],
      params: youtubeBotIdParam,
      response: {
        200: youtubeBotResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await db.query('SELECT * FROM bot_youtube WHERE id = ?', [id]);

    if (rows.length === 0) {
      return notFound(reply, 'YouTube 봇을 찾을 수 없습니다.');
    }

    return formatBotResponse(rows[0]);
  });

  /**
   * POST /api/admin/youtube-bots
   * YouTube 봇 추가
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/youtube-bots'],
      summary: 'YouTube 봇 추가',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          channel_id: { type: 'string' },
          channel_handle: { type: ['string', 'null'] },
          channel_name: { type: 'string' },
          banner_url: { type: ['string', 'null'] },
          cron_interval: { type: ['integer', 'null'] },
          title_filters: { type: ['array', 'null'], items: { type: 'string' } },
          exclude_shorts: { type: 'boolean', default: false },
          archive_shorts: { type: 'boolean', default: true },
          auto_schedule_config: { type: ['object', 'null'], additionalProperties: true },
          weekly_schedule_config: { type: ['object', 'null'], additionalProperties: true },
          video_category: { type: 'string', enum: ['official', 'sp', 'variety', 'music'], default: 'variety' },
          add_to_schedule: { type: 'boolean', default: true },
        },
        required: ['channel_id', 'channel_name'],
      },
      response: {
        201: youtubeBotResponse,
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const {
      channel_id,
      channel_handle,
      channel_name,
      banner_url,
      cron_interval,
      title_filters,
      exclude_shorts = false,
      archive_shorts = true,
      auto_schedule_config,
      weekly_schedule_config,
      video_category = 'variety',
      add_to_schedule = true,
    } = request.body;

    // 중복 체크
    const [existing] = await db.query(
      'SELECT id FROM bot_youtube WHERE channel_id = ?',
      [channel_id]
    );
    if (existing.length > 0) {
      return badRequest(reply, '이미 등록된 채널입니다.');
    }

    // weekly 모드면 cron_interval은 무시(null 저장), 아니면 기본값 2
    const finalCronInterval = weekly_schedule_config ? null : (cron_interval ?? 2);

    const [result] = await db.query(
      `INSERT INTO bot_youtube
        (channel_id, channel_handle, channel_name, banner_url, cron_interval,
         title_filters, exclude_shorts, archive_shorts, auto_schedule_config, weekly_schedule_config,
         video_category, add_to_schedule, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        channel_id,
        channel_handle || null,
        channel_name,
        banner_url || null,
        finalCronInterval,
        title_filters ? JSON.stringify(title_filters) : null,
        exclude_shorts ? 1 : 0,
        archive_shorts ? 1 : 0,
        auto_schedule_config ? JSON.stringify(auto_schedule_config) : null,
        weekly_schedule_config ? JSON.stringify(weekly_schedule_config) : null,
        video_category,
        add_to_schedule ? 1 : 0,
      ]
    );

    // 스케줄러 캐시 무효화 및 봇 시작
    scheduler.invalidateCache();
    const botId = `youtube-${result.insertId}`;
    try {
      await scheduler.startBot(botId);
    } catch (err) {
      fastify.log.error(`[${botId}] 봇 시작 실패:`, err);
    }

    const [newBot] = await db.query('SELECT * FROM bot_youtube WHERE id = ?', [result.insertId]);
    reply.code(201);
    logActivity(db, { actor: 'admin', action: 'create', category: 'bot', targetType: 'youtube_bot', targetId: result.insertId, summary: `YouTube 봇 생성: ${channel_name}` });
    return formatBotResponse(newBot[0]);
  });

  /**
   * PUT /api/admin/youtube-bots/:id
   * YouTube 봇 수정
   */
  fastify.put('/:id', {
    schema: {
      tags: ['admin/youtube-bots'],
      summary: 'YouTube 봇 수정',
      security: [{ bearerAuth: [] }],
      params: youtubeBotIdParam,
      body: {
        type: 'object',
        properties: {
          channel_handle: { type: ['string', 'null'] },
          channel_name: { type: 'string' },
          banner_url: { type: ['string', 'null'] },
          cron_interval: { type: ['integer', 'null'] },
          title_filters: { type: ['array', 'null'], items: { type: 'string' } },
          exclude_shorts: { type: 'boolean' },
    archive_shorts: { type: 'boolean' },
          auto_schedule_config: { type: ['object', 'null'], additionalProperties: true },
          weekly_schedule_config: { type: ['object', 'null'], additionalProperties: true },
          enabled: { type: 'boolean' },
          video_category: { type: 'string', enum: ['official', 'sp', 'variety', 'music'] },
          add_to_schedule: { type: 'boolean' },
        },
      },
      response: {
        200: youtubeBotResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    // 존재 확인
    const [existing] = await db.query('SELECT * FROM bot_youtube WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, 'YouTube 봇을 찾을 수 없습니다.');
    }

    // 동적 업데이트 쿼리 생성
    const fields = [];
    const values = [];

    if (updates.channel_handle !== undefined) {
      fields.push('channel_handle = ?');
      values.push(updates.channel_handle);
    }
    if (updates.channel_name !== undefined) {
      fields.push('channel_name = ?');
      values.push(updates.channel_name);
    }
    if (updates.banner_url !== undefined) {
      fields.push('banner_url = ?');
      values.push(updates.banner_url);
    }
    if (updates.cron_interval !== undefined) {
      fields.push('cron_interval = ?');
      values.push(updates.cron_interval);
    }
    if (updates.title_filters !== undefined) {
      fields.push('title_filters = ?');
      values.push(JSON.stringify(updates.title_filters));
    }
    if (updates.exclude_shorts !== undefined) {
      fields.push('exclude_shorts = ?');
      values.push(updates.exclude_shorts ? 1 : 0);
    }
    if (updates.archive_shorts !== undefined) {
      fields.push('archive_shorts = ?');
      values.push(updates.archive_shorts ? 1 : 0);
    }
    if (updates.video_category !== undefined) {
      fields.push('video_category = ?');
      values.push(updates.video_category);
    }
    if (updates.add_to_schedule !== undefined) {
      fields.push('add_to_schedule = ?');
      values.push(updates.add_to_schedule ? 1 : 0);
    }
    if (updates.auto_schedule_config !== undefined) {
      fields.push('auto_schedule_config = ?');
      values.push(updates.auto_schedule_config ? JSON.stringify(updates.auto_schedule_config) : null);
    }
    if (updates.weekly_schedule_config !== undefined) {
      fields.push('weekly_schedule_config = ?');
      values.push(updates.weekly_schedule_config ? JSON.stringify(updates.weekly_schedule_config) : null);
      // weekly 모드로 전환하면 cron_interval은 null, 해제하면 기본값으로 복구(명시 cron_interval이 같이 오지 않은 경우)
      if (updates.cron_interval === undefined) {
        fields.push('cron_interval = ?');
        values.push(updates.weekly_schedule_config ? null : 2);
      }
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      await db.query(
        `UPDATE bot_youtube SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // 필터 설정이 바뀌면 스킵 캐시 초기화 — 이전에 거부된 영상을 새 기준으로 재평가
      if (updates.title_filters !== undefined || updates.exclude_shorts !== undefined) {
        await db.query('DELETE FROM youtube_skipped_videos WHERE channel_id = ?', [
          existing[0].channel_id,
        ]);
      }

      // 스케줄러 캐시 무효화 및 봇 재시작
      scheduler.invalidateCache();
      const botId = `youtube-${id}`;
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

    const [updatedBot] = await db.query('SELECT * FROM bot_youtube WHERE id = ?', [id]);
    logActivity(db, { actor: 'admin', action: 'update', category: 'bot', targetType: 'youtube_bot', targetId: parseInt(id), summary: `YouTube 봇 수정: ${existing[0].channel_name}` });
    return formatBotResponse(updatedBot[0]);
  });

  /**
   * DELETE /api/admin/youtube-bots/:id
   * YouTube 봇 삭제
   */
  fastify.delete('/:id', {
    schema: {
      tags: ['admin/youtube-bots'],
      summary: 'YouTube 봇 삭제',
      security: [{ bearerAuth: [] }],
      params: youtubeBotIdParam,
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
    const [existing] = await db.query('SELECT * FROM bot_youtube WHERE id = ?', [id]);
    if (existing.length === 0) {
      return notFound(reply, 'YouTube 봇을 찾을 수 없습니다.');
    }

    // 봇 정지
    const botId = `youtube-${id}`;
    try {
      await scheduler.stopBot(botId);
    } catch (err) {
      // 이미 정지된 경우 무시
    }

    // DB에서 삭제
    await db.query('DELETE FROM bot_youtube WHERE id = ?', [id]);

    // 스케줄러 캐시 무효화
    scheduler.invalidateCache();

    logActivity(db, { actor: 'admin', action: 'delete', category: 'bot', targetType: 'youtube_bot', targetId: parseInt(id), summary: `YouTube 봇 삭제: ${existing[0].channel_name}` });
    return { success: true };
  });
}
