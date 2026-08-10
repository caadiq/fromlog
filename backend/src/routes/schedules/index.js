/**
 * 일정 라우트
 * GET: 공개, POST/PUT/DELETE: 인증 필요
 */
import suggestionsRoutes from './suggestions.js';
import { searchSchedules, syncAllSchedules, deleteSchedule } from '../../services/meilisearch/index.js';
import { fetchTiktokThumbnail } from '../../services/x/og.js';
import { CATEGORY_IDS } from '../../config/index.js';
import {
  getCategories,
  getScheduleDetail,
  getMonthlySchedules,
  getUpcomingSchedules,
} from '../../services/schedule.js';
import {
  errorResponse,
  scheduleSearchQuery,
  scheduleSearchResponse,
  idParam,
} from '../../schemas/index.js';
import { badRequest, notFound, serverError } from '../../utils/error.js';
import { withTransaction } from '../../utils/transaction.js';
import { logActivity } from '../../utils/log.js';

export default async function schedulesRoutes(fastify) {
  const { db, meilisearch, redis } = fastify;

  // 추천 검색어 라우트 등록
  fastify.register(suggestionsRoutes, { prefix: '/suggestions' });

  /**
   * GET /api/schedules/x-card-thumb/:postId
   * 만료성 카드 썸네일(현재 TikTok) 온디맨드 프록시.
   * 저장하지 않고 요청 시 oEmbed로 현재 유효한 썸네일을 받아 리다이렉트.
   * Redis로 캐싱(6h)하여 호출 최소화.
   */
  fastify.get('/x-card-thumb/:postId', {
    schema: {
      tags: ['schedules'],
      summary: 'X 카드 썸네일 프록시 (TikTok 등 만료성 이미지)',
      params: {
        type: 'object',
        properties: { postId: { type: 'string' } },
        required: ['postId'],
      },
    },
  }, async (request, reply) => {
    const { postId } = request.params;
    const cacheKey = `x:cardthumb:${postId}`;
    try {
      const cached = redis ? await redis.get(cacheKey) : null;
      if (cached) return reply.redirect(cached);

      const [rows] = await db.query(
        'SELECT content, card_data FROM schedule_x WHERE post_id = ? LIMIT 1',
        [postId]
      );
      if (rows.length === 0) return reply.code(404).send();

      // TikTok URL 추출 (card_data.url 우선, 없으면 본문)
      let url = null;
      try {
        const c = typeof rows[0].card_data === 'string'
          ? JSON.parse(rows[0].card_data) : rows[0].card_data;
        if (c?.url && /tiktok\.com/.test(c.url)) url = c.url;
      } catch { /* noop */ }
      if (!url) {
        const m = (rows[0].content || '').match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/i);
        if (m) url = m[0];
      }
      if (!url) return reply.code(404).send();

      const thumb = await fetchTiktokThumbnail(url);
      if (!thumb) return reply.code(404).send();

      if (redis) await redis.set(cacheKey, thumb, 'EX', 21600); // 6시간
      return reply.redirect(thumb);
    } catch (err) {
      fastify.log.error(`[x-card-thumb] ${postId}: ${err.message}`);
      return reply.code(404).send();
    }
  });

  /**
   * GET /api/schedules/categories
   * 카테고리 목록 조회
   */
  fastify.get('/categories', {
    schema: {
      tags: ['schedules'],
      summary: '카테고리 목록 조회',
      description: '일정 카테고리 목록을 조회합니다.',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async (request, reply) => {
    try {
      return await getCategories(db, redis);
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '카테고리 목록 조회 실패');
    }
  });

  /**
   * GET /api/schedules
   * 검색 모드: search 파라미터가 있으면 Meilisearch 검색
   * 월별 조회 모드: year, month 파라미터로 월별 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['schedules'],
      summary: '일정 조회 (검색 또는 월별)',
      description: 'search 파라미터로 검색, year/month로 월별 조회, startDate로 다가오는 일정 조회',
      querystring: scheduleSearchQuery,
      response: {
        200: {
          oneOf: [
            { type: 'object', additionalProperties: true },
            { type: 'array', items: { type: 'object', additionalProperties: true } },
          ],
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { search, year, month, startDate, offset = 0, limit = 100 } = request.query;

      // 검색 모드
      if (search && search.trim()) {
        return await handleSearch(fastify, search.trim(), parseInt(offset), parseInt(limit));
      }

      // 다가오는 일정 조회 (startDate부터)
      if (startDate) {
        return await getUpcomingSchedules(db, startDate, parseInt(limit));
      }

      // 월별 조회 모드
      if (!year || !month) {
        return badRequest(reply, 'search, startDate, 또는 year/month는 필수입니다.');
      }

      return await getMonthlySchedules(db, parseInt(year), parseInt(month), redis);
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '일정 조회 실패');
    }
  });

  /**
   * POST /api/schedules/sync-search
   * Meilisearch 전체 동기화 (관리자 전용)
   */
  fastify.post('/sync-search', {
    schema: {
      tags: ['schedules'],
      summary: 'Meilisearch 전체 동기화',
      description: 'DB의 모든 일정을 Meilisearch에 동기화합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            synced: { type: 'integer', description: '동기화된 일정 수' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const count = await syncAllSchedules(meilisearch, db);
      return { success: true, synced: count };
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '동기화 실패');
    }
  });

  /**
   * GET /api/schedules/:id
   * 일정 상세 조회 (카테고리별 다른 형식 반환)
   */
  fastify.get('/:id', {
    schema: {
      tags: ['schedules'],
      summary: '일정 상세 조회',
      description: '일정 ID로 상세 정보를 조회합니다. 카테고리에 따라 추가 정보(YouTube/X)가 포함됩니다.',
      params: idParam,
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request, reply) => {
    try {
      const result = await getScheduleDetail(
        db,
        request.params.id,
        (username) => fastify.xBot.getProfile(username)
      );

      if (!result) {
        return notFound(reply, '일정을 찾을 수 없습니다.');
      }

      // 유튜브 카테고리인 경우 채널 배너 이미지 추가
      if (result.category?.id === CATEGORY_IDS.YOUTUBE) {
        const [youtubeData] = await db.query(
          `SELECT yb.banner_url
           FROM schedule_youtube sy
           LEFT JOIN bot_youtube yb ON sy.channel_id = yb.channel_id
           WHERE sy.schedule_id = ?`,
          [request.params.id]
        );
        if (youtubeData.length > 0 && youtubeData[0].banner_url) {
          result.bannerUrl = youtubeData[0].banner_url;
        }
      }

      return result;
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '일정 상세 조회 실패');
    }
  });

  /**
   * DELETE /api/schedules/:id
   * 일정 삭제 (인증 필요)
   */
  fastify.delete('/:id', {
    schema: {
      tags: ['schedules'],
      summary: '일정 삭제',
      description: '일정과 관련 데이터(YouTube/X 정보, 멤버, 이미지)를 삭제합니다.',
      security: [{ bearerAuth: [] }],
      params: idParam,
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
    try {
      const { id } = request.params;

      // 일정 존재 확인 - 트랜잭션 전에 수행
      const [existing] = await db.query('SELECT id FROM schedules WHERE id = ?', [id]);
      if (existing.length === 0) {
        return notFound(reply, '일정을 찾을 수 없습니다.');
      }

      // 트랜잭션으로 DELETE 작업 수행
      await withTransaction(db, async (connection) => {
        // 관련 테이블 삭제 (외래 키)
        await connection.query('DELETE FROM schedule_youtube WHERE schedule_id = ?', [id]);
        await connection.query('DELETE FROM schedule_x WHERE schedule_id = ?', [id]);
        await connection.query('DELETE FROM schedule_images WHERE schedule_id = ?', [id]);

        // 메인 테이블 삭제
        await connection.query('DELETE FROM schedules WHERE id = ?', [id]);
      });

      // Meilisearch에서도 삭제 + 월별 캐시 무효화 (트랜잭션 외부, 실패해도 무시)
      await deleteSchedule(meilisearch, id, redis);

      logActivity(db, { actor: 'admin', action: 'delete', category: 'schedule', targetType: null, targetId: parseInt(id), summary: `일정 삭제: ${id}` });
      return { success: true };
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '일정 삭제 실패');
    }
  });
}

/**
 * 검색 처리
 */
async function handleSearch(fastify, query, offset, limit) {
  const { db, meilisearch } = fastify;

  // 첫 페이지 검색 시에만 검색어 저장 (bi-gram 학습)
  if (offset === 0) {
    // 비동기로 저장 (응답 지연 방지)
    saveSearchQueryAsync(fastify, query);
  }

  // Meilisearch 검색 (페이징 포함)
  const results = await searchSchedules(meilisearch, db, query, { offset, limit });

  return {
    schedules: results.hits,
    total: results.total,
    offset: results.offset,
    limit: results.limit,
    hasMore: results.hasMore,
  };
}

/**
 * 검색어 비동기 저장
 */
async function saveSearchQueryAsync(fastify, query) {
  try {
    // suggestions 서비스의 saveSearchQuery 사용
    const { SuggestionService } = await import('../../services/suggestions/index.js');
    const service = new SuggestionService(fastify.db, fastify.redis);
    await service.saveSearchQuery(query);
  } catch (err) {
    fastify.log.error(`[Search] 검색어 저장 실패: ${err.message}`);
  }
}
