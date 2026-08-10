import { fetchSingleTweet, extractTitle } from '../../services/x/scraper.js';
import { addOrUpdateSchedule, syncScheduleById } from '../../services/meilisearch/index.js';
import { formatDate, formatTime } from '../../utils/date.js';
import config, { CATEGORY_IDS } from '../../config/index.js';
import {
  errorResponse,
  xPostInfoQuery,
  xScheduleCreate,
} from '../../schemas/index.js';
import { badRequest, conflict, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

const X_CATEGORY_ID = CATEGORY_IDS.X;
const NITTER_URL = config.nitter?.url || process.env.NITTER_URL || 'http://nitter:8080';
const DEFAULT_USERNAME = config.x.defaultUsername;

/**
 * X(Twitter) 관련 관리자 라우트
 */
export default async function xRoutes(fastify) {
  const { db, meilisearch } = fastify;

  /**
   * GET /api/admin/x/post-info
   * X 게시글 정보 조회
   */
  fastify.get('/post-info', {
    schema: {
      tags: ['admin/x'],
      summary: 'X 게시글 정보 조회',
      description: 'X(Twitter) 게시글 ID로 정보를 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: xPostInfoQuery,
      response: {
        200: {
          type: 'object',
          properties: {
            postId: { type: 'string' },
            username: { type: 'string' },
            text: { type: 'string' },
            title: { type: 'string' },
            imageUrls: { type: 'array', items: { type: 'string' } },
            date: { type: 'string' },
            time: { type: 'string' },
            postUrl: { type: 'string' },
            profile: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                displayName: { type: 'string' },
                avatarUrl: { type: 'string' },
              },
            },
          },
        },
        400: errorResponse,
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { postId, username = DEFAULT_USERNAME } = request.query;

    // 게시글 ID 유효성 검사
    if (!/^\d+$/.test(postId)) {
      return badRequest(reply, '유효하지 않은 게시글 ID입니다.');
    }

    try {
      const tweet = await fetchSingleTweet(NITTER_URL, username, postId);

      return {
        postId: tweet.id,
        username,
        text: tweet.text,
        title: extractTitle(tweet.text),
        imageUrls: tweet.imageUrls,
        date: tweet.time ? formatDate(tweet.time) : null,
        time: tweet.time ? formatTime(tweet.time) : null,
        postUrl: tweet.url,
        profile: tweet.profile,
      };
    } catch (err) {
      fastify.log.error(`X 게시글 조회 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * POST /api/admin/x/schedule
   * X 일정 저장
   */
  fastify.post('/schedule', {
    schema: {
      tags: ['admin/x'],
      summary: 'X 일정 저장',
      description: 'X(Twitter) 게시글을 일정으로 등록합니다.',
      security: [{ bearerAuth: [] }],
      body: xScheduleCreate,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            scheduleId: { type: 'integer' },
          },
        },
        409: errorResponse,
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { postId, title, content, imageUrls, date, time } = request.body;

    try {
      // 중복 체크
      const [existing] = await db.query(
        'SELECT id FROM schedule_x WHERE post_id = ?',
        [postId]
      );
      if (existing.length > 0) {
        return conflict(reply, '이미 등록된 게시글입니다.');
      }

      // schedules 테이블에 저장
      const [result] = await db.query(
        'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
        [X_CATEGORY_ID, title, date, time || null]
      );
      const scheduleId = result.insertId;

      // schedule_x 테이블에 저장
      await db.query(
        'INSERT INTO schedule_x (schedule_id, post_id, content, image_urls) VALUES (?, ?, ?, ?)',
        [scheduleId, postId, content || null, imageUrls?.length > 0 ? JSON.stringify(imageUrls) : null]
      );

      // Meilisearch 동기화
      const [categoryRows] = await db.query(
        'SELECT name, color FROM schedule_categories WHERE id = ?',
        [X_CATEGORY_ID]
      );
      const category = categoryRows[0] || {};

      await addOrUpdateSchedule(meilisearch, {
        id: scheduleId,
        title,
        date,
        time: time || '',
        category_id: X_CATEGORY_ID,
        category_name: category.name || '',
        category_color: category.color || '',
        source_name: '',
      }, fastify.redis);

      logActivity(db, { actor: 'admin', action: 'create', category: 'schedule', targetType: 'x_schedule', targetId: scheduleId, summary: `X 일정 생성: ${title}` });
      return { success: true, scheduleId };
    } catch (err) {
      fastify.log.error(`X 일정 저장 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * POST /api/admin/x/refetch-retweets
   * 리트윗 데이터 재수집 (잘못된 content/image_urls 수정)
   */
  fastify.post('/refetch-retweets', {
    schema: {
      tags: ['admin/x'],
      summary: '리트윗 데이터 재수집',
      description: '잘못 저장된 리트윗 일정을 Nitter에서 다시 가져와 수정합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          scheduleIds: {
            type: 'array',
            items: { type: 'integer' },
            description: '재수집할 일정 ID 목록 (비어있으면 전체 리트윗 대상)',
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      let rows;
      const { scheduleIds } = request.body || {};

      if (scheduleIds && scheduleIds.length > 0) {
        // 특정 일정만
        [rows] = await db.query(
          `SELECT sx.schedule_id, sx.post_id, sx.username, sx.content
           FROM schedule_x sx
           WHERE sx.schedule_id IN (?)`,
          [scheduleIds]
        );
      } else {
        // content가 "RT @"로 시작하거나, image_urls가 NULL이면서 nitter 링크가 있는 일정
        [rows] = await db.query(
          `SELECT sx.schedule_id, sx.post_id, sx.username, sx.content
           FROM schedule_x sx
           WHERE sx.content LIKE 'RT @%'
              OR (sx.content LIKE '%nitter%t.co%')
              OR (sx.image_urls IS NULL AND sx.content LIKE 'RT @%')`
        );
      }

      if (rows.length === 0) {
        return { success: true, message: '재수집 대상이 없습니다.', updated: 0 };
      }

      let updated = 0;
      const errors = [];

      for (const row of rows) {
        try {
          // content에서 원본 작성자 추출 (RT @username: 형식)
          let fetchUsername = row.username || DEFAULT_USERNAME;
          const rtMatch = row.content?.match(/^RT @(\w+):/);
          if (rtMatch) {
            fetchUsername = rtMatch[1];
          }

          // 원본 작성자의 개별 트윗 페이지에서 가져오기
          const tweet = await fetchSingleTweet(NITTER_URL, fetchUsername, row.post_id);

          // fetchSingleTweet이 RT @ 형식을 반환하면 RT 프리픽스 제거
          let newContent = tweet.text;
          const rtPrefixMatch = newContent.match(/^RT @\w+:\s*/);
          if (rtPrefixMatch) {
            newContent = newContent.slice(rtPrefixMatch[0].length);
          }
          // 끝의 … 제거
          newContent = newContent.replace(/…$/, '').trim();

          const newTitle = extractTitle(newContent);
          const newImageUrls = tweet.imageUrls.length > 0 ? JSON.stringify(tweet.imageUrls) : null;

          // schedules 테이블 업데이트
          await db.query(
            'UPDATE schedules SET title = ? WHERE id = ?',
            [newTitle, row.schedule_id]
          );

          // schedule_x 테이블 업데이트 (원본 작성자 username도 수정)
          await db.query(
            'UPDATE schedule_x SET username = ?, content = ?, image_urls = ? WHERE schedule_id = ?',
            [fetchUsername, newContent, newImageUrls, row.schedule_id]
          );

          // Meilisearch 동기화 + 월별 캐시 무효화
          await syncScheduleById(meilisearch, db, row.schedule_id, fastify.redis);

          updated++;
          fastify.log.info(`리트윗 재수집 완료: schedule_id=${row.schedule_id}, post_id=${row.post_id}`);

          // Nitter 부하 방지
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          errors.push({ scheduleId: row.schedule_id, postId: row.post_id, error: err.message });
          fastify.log.error(`리트윗 재수집 실패 (${row.schedule_id}): ${err.message}`);
        }
      }

      logActivity(db, {
        actor: 'admin',
        action: 'update',
        category: 'schedule',
        targetType: 'x_schedule',
        summary: `리트윗 재수집: ${updated}/${rows.length}건 완료`,
      });

      return { success: true, total: rows.length, updated, errors };
    } catch (err) {
      fastify.log.error(`리트윗 재수집 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });
}
