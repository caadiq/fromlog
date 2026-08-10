/**
 * 추천 검색어 API 라우트
 */
import { readFile, writeFile } from 'fs/promises';
import { SuggestionService } from '../../services/suggestions/index.js';
import { reloadMorpheme, getUserDictPath } from '../../services/suggestions/morpheme.js';
import { badRequest, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

let suggestionService = null;

export default async function suggestionsRoutes(fastify) {
  const { db, redis } = fastify;

  // 서비스 초기화 (한 번만)
  if (!suggestionService) {
    suggestionService = new SuggestionService(db, redis);
    // 비동기 초기화 (형태소 분석기 로드)
    suggestionService.initialize().catch(err => {
      fastify.log.error(`[Suggestions] 서비스 초기화 실패: ${err.message}`);
    });
  }

  /**
   * GET /api/schedules/suggestions
   * 추천 검색어 조회
   */
  fastify.get('/', {
    schema: {
      tags: ['suggestions'],
      summary: '추천 검색어 조회',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '검색어' },
          limit: { type: 'integer', default: 10, description: '결과 개수' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { q, limit = 10 } = request.query;

    if (!q || q.trim().length === 0) {
      return { suggestions: [] };
    }

    const suggestions = await suggestionService.getSuggestions(q, limit);
    return { suggestions };
  });

  /**
   * GET /api/schedules/suggestions/popular
   * 인기 검색어 조회
   */
  fastify.get('/popular', {
    schema: {
      tags: ['suggestions'],
      summary: '인기 검색어 조회',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10, description: '결과 개수' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { limit = 10 } = request.query;
    const queries = await suggestionService.getPopularQueries(limit);
    return { queries };
  });

  /**
   * POST /api/schedules/suggestions/save
   * 검색어 저장 (검색 실행 시 호출)
   */
  fastify.post('/save', {
    schema: {
      tags: ['suggestions'],
      summary: '검색어 저장',
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: '검색어' },
        },
      },
    },
  }, async (request, reply) => {
    const { query } = request.body;

    if (!query || query.trim().length === 0) {
      return badRequest(reply, '검색어가 필요합니다.');
    }

    await suggestionService.saveSearchQuery(query);
    return { message: '검색어가 저장되었습니다.' };
  });

  /**
   * GET /api/schedules/suggestions/dict
   * 사용자 사전 조회 (관리자 전용)
   */
  fastify.get('/dict', {
    schema: {
      tags: ['suggestions'],
      summary: '사용자 사전 조회',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '사전 내용' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const dictPath = getUserDictPath();
      const content = await readFile(dictPath, 'utf-8');
      return { content };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { content: '' };
      }
      throw error;
    }
  });

  /**
   * PUT /api/schedules/suggestions/dict
   * 사용자 사전 저장 및 리로드 (관리자 전용)
   */
  fastify.put('/dict', {
    schema: {
      tags: ['suggestions'],
      summary: '사용자 사전 저장',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: '사전 내용' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { content } = request.body;

    try {
      const dictPath = getUserDictPath();
      await writeFile(dictPath, content, 'utf-8');

      // 형태소 분석기 리로드
      await reloadMorpheme();

      logActivity(db, { actor: 'admin', action: 'update', category: 'dict', targetType: 'dict', targetId: null, summary: '사전 저장' });
      return { message: '사전이 저장되었습니다.' };
    } catch (error) {
      fastify.log.error(`[Suggestions] 사전 저장 오류: ${error.message}`);
      return serverError(reply, '사전 저장 중 오류가 발생했습니다.');
    }
  });
}
