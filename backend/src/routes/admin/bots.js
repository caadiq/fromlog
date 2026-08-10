import { errorResponse } from '../../schemas/index.js';
import { syncAllSchedules } from '../../services/meilisearch/index.js';
import { badRequest, notFound, serverError } from '../../utils/error.js';
import { nowKST } from '../../utils/date.js';
import { logActivity } from '../../utils/log.js';

// 봇 관련 스키마
const botResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['youtube', 'x', 'meilisearch', 'festival'] },
    status: { type: 'string', enum: ['running', 'stopped', 'error'] },
    last_check_at: { type: 'string', format: 'date-time' },
    last_added_count: { type: 'integer' },
    last_sync_duration: { type: 'integer', description: '마지막 동기화 소요 시간 (ms)' },
    schedules_added: { type: 'integer' },
    check_interval: { type: 'integer' },
    error_message: { type: 'string' },
    enabled: { type: 'boolean' },
    // YouTube 봇 전용 필드
    db_id: { type: 'integer' },
    channel_id: { type: 'string' },
    channel_handle: { type: 'string' },
    channel_name: { type: 'string' },
    banner_url: { type: 'string' },
    cron_interval: { type: 'integer' },
    title_filters: { type: 'array', items: { type: 'string' } },
    auto_schedule_config: { type: ['object', 'null'], additionalProperties: true },
    weekly_schedule_config: { type: ['object', 'null'], additionalProperties: true },
    // X 봇 전용 필드
    username: { type: 'string' },
    display_name: { type: 'string' },
    avatar_url: { type: 'string' },
    text_filters: { type: 'array', items: { type: 'string' } },
    // 축제 봇 전용 필드
    search_url: { type: 'string' },
  },
};

const botIdParam = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '봇 ID' },
  },
  required: ['id'],
};

/**
 * 봇 관리 라우트
 * 인증 필요
 */
export default async function botsRoutes(fastify) {
  const { scheduler, redis, db } = fastify;
  const QUOTA_WARNING_KEY = 'youtube:quota_warning';

  /**
   * GET /api/admin/bots
   * 봇 목록 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['admin/bots'],
      summary: '봇 목록 조회',
      description: '등록된 모든 봇(YouTube, X)의 상태를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: botResponse,
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    // API 호출 시에는 항상 fresh한 데이터 반환
    const allBots = await scheduler.getBots(true);
    const result = [];

    for (const bot of allBots) {
      const status = await scheduler.getStatus(bot.id);

      // cron 표현식에서 간격 추출 (분 단위, 일일 스케줄은 1440분)
      let checkInterval = 2; // 기본값
      if (bot.cronInterval) {
        // 축제 봇 등 분 단위 간격을 직접 가진 봇
        checkInterval = bot.cronInterval;
      } else {
        const cronMatch = bot.cron.match(/^\*\/(\d+)/);
        const hourMatch = bot.cron.match(/^0 \*\/(\d+) \* \* \*$/);
        if (cronMatch) {
          checkInterval = parseInt(cronMatch[1]);
        } else if (hourMatch) {
          // 시간 단위 (예: 0 *\/6 * * *)
          checkInterval = parseInt(hourMatch[1]) * 60;
        } else if (/^0 \d+ \* \* \*$/.test(bot.cron)) {
          // 매일 특정 시간 (예: 0 12 * * *)
          checkInterval = 1440;
        }
      }

      const botData = {
        id: bot.id,
        name: bot.name || bot.channelName || bot.username || bot.id,
        type: bot.type,
        status: status.status,
        last_check_at: status.lastCheckAt,
        last_added_count: status.lastAddedCount,
        last_sync_duration: status.lastSyncDuration,
        schedules_added: status.totalAdded,
        check_interval: checkInterval,
        error_message: status.errorMessage,
        enabled: bot.enabled,
      };

      // YouTube 봇인 경우 상세 정보 추가
      if (bot.type === 'youtube') {
        botData.db_id = bot.dbId;
        botData.channel_id = bot.channelId;
        botData.channel_handle = bot.channelHandle;
        botData.channel_name = bot.channelName;
        botData.banner_url = bot.bannerUrl;
        botData.cron_interval = checkInterval;
        botData.title_filters = bot.titleFilters || [];
        botData.auto_schedule_config = bot.autoScheduleNext || null;
        botData.weekly_schedule_config = bot.weeklySchedule || null;
      }

      // X 봇인 경우 상세 정보 추가
      if (bot.type === 'x') {
        botData.db_id = bot.dbId;
        botData.username = bot.username;
        botData.display_name = bot.displayName;
        botData.avatar_url = bot.avatarUrl;
        botData.text_filters = bot.textFilters || [];
        botData.cron_interval = checkInterval;
      }

      // 축제 봇인 경우 상세 정보 추가
      if (bot.type === 'festival') {
        botData.db_id = bot.dbId;
        botData.search_url = bot.searchUrl;
        botData.cron_interval = checkInterval;
      }

      result.push(botData);
    }

    return result;
  });

  /**
   * POST /api/admin/bots/:id/start
   * 봇 시작
   */
  fastify.post('/:id/start', {
    schema: {
      tags: ['admin/bots'],
      summary: '봇 시작',
      description: '지정된 봇의 스케줄러를 시작합니다.',
      security: [{ bearerAuth: [] }],
      params: botIdParam,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      await scheduler.startBot(id);
      logActivity(db, { actor: 'admin', action: 'start', category: 'bot', targetType: null, targetId: null, summary: `봇 시작: ${id}` });
      return { success: true, message: '봇이 시작되었습니다.' };
    } catch (err) {
      return badRequest(reply, err.message);
    }
  });

  /**
   * POST /api/admin/bots/:id/stop
   * 봇 정지
   */
  fastify.post('/:id/stop', {
    schema: {
      tags: ['admin/bots'],
      summary: '봇 정지',
      description: '지정된 봇의 스케줄러를 정지합니다.',
      security: [{ bearerAuth: [] }],
      params: botIdParam,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      await scheduler.stopBot(id);
      logActivity(db, { actor: 'admin', action: 'stop', category: 'bot', targetType: null, targetId: null, summary: `봇 정지: ${id}` });
      return { success: true, message: '봇이 정지되었습니다.' };
    } catch (err) {
      return badRequest(reply, err.message);
    }
  });

  /**
   * POST /api/admin/bots/:id/sync-all
   * 전체 동기화
   */
  fastify.post('/:id/sync-all', {
    schema: {
      tags: ['admin/bots'],
      summary: '봇 전체 동기화',
      description: '봇이 관리하는 모든 콘텐츠를 다시 동기화합니다.',
      security: [{ bearerAuth: [] }],
      params: botIdParam,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            addedCount: { type: 'integer', description: '추가된 일정 수' },
            total: { type: 'integer', description: '총 처리 수' },
          },
        },
        400: errorResponse,
        404: errorResponse,
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const allBots = await scheduler.getBots();
    const bot = allBots.find(b => b.id === id);
    if (!bot) {
      return notFound(reply, '봇을 찾을 수 없습니다.');
    }

    const startTime = Date.now();
    try {
      let result;
      if (bot.type === 'youtube') {
        result = await fastify.youtubeBot.syncAllVideos(bot);
      } else if (bot.type === 'x') {
        result = await fastify.xBot.syncAllTweets(bot);
      } else if (bot.type === 'festival') {
        result = await fastify.festivalBot.syncNewFestivals(bot);
      } else if (bot.type === 'meilisearch') {
        const count = await syncAllSchedules(fastify.meilisearch, fastify.db);
        result = { addedCount: count, total: count };
      } else {
        return badRequest(reply, '지원하지 않는 봇 타입입니다.');
      }

      const duration = Date.now() - startTime;

      // 상태 업데이트
      const status = await scheduler.getStatus(id);
      await fastify.redis.set(`bot:status:${id}`, JSON.stringify({
        ...status,
        lastCheckAt: nowKST(),
        lastAddedCount: result.addedCount,
        lastSyncDuration: duration,
        totalAdded: (status.totalAdded || 0) + result.addedCount,
        updatedAt: nowKST(),
      }));

      logActivity(db, { actor: 'admin', action: 'sync_complete', category: 'sync', targetType: null, targetId: null, summary: `전체 동기화: ${id} (${result.addedCount}개 추가)` });
      return {
        success: true,
        addedCount: result.addedCount,
        total: result.total,
      };
    } catch (err) {
      fastify.log.error(`[${id}] 전체 동기화 오류:`, err);
      return serverError(reply, err.message);
    }
  });

  /**
   * GET /api/admin/quota-warning
   * 할당량 경고 조회
   */
  fastify.get('/quota-warning', {
    schema: {
      tags: ['admin/bots'],
      summary: '할당량 경고 조회',
      description: 'YouTube API 할당량 경고 상태를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            active: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const data = await redis.get(QUOTA_WARNING_KEY);
    if (data) {
      return { active: true, ...JSON.parse(data) };
    }
    return { active: false };
  });

  /**
   * DELETE /api/admin/quota-warning
   * 할당량 경고 해제
   */
  fastify.delete('/quota-warning', {
    schema: {
      tags: ['admin/bots'],
      summary: '할당량 경고 해제',
      description: 'YouTube API 할당량 경고를 해제합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    await redis.del(QUOTA_WARNING_KEY);
    return { success: true };
  });
}
