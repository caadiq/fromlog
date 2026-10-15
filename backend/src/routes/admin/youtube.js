import { updateVideoType } from '../../services/video-type.js';
import { withTransaction } from '../../utils/transaction.js';
import { fetchVideoInfo } from '../../services/youtube/api.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';
import { archiveVideo, inferCategory } from '../../services/videos.js';
import { CATEGORY_IDS } from '../../config/index.js';
import {
  errorResponse,
  youtubeVideoInfo,
  youtubeScheduleCreate,
  youtubeScheduleUpdate,
  idParam,
} from '../../schemas/index.js';
import { badRequest, notFound, conflict, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

const YOUTUBE_CATEGORY_ID = CATEGORY_IDS.YOUTUBE;

/**
 * YouTube 관련 관리자 라우트
 */
export default async function youtubeRoutes(fastify) {
  const { db, meilisearch } = fastify;
  /**
   * GET /api/admin/youtube/video-info
   * YouTube 영상 정보 조회
   */
  fastify.get('/video-info', {
    schema: {
      tags: ['admin/youtube'],
      summary: 'YouTube 영상 정보 조회',
      description: 'YouTube URL에서 영상 정보를 추출합니다.',
      security: [{ bearerAuth: [] }],
      querystring: youtubeVideoInfo,
      response: {
        200: {
          type: 'object',
          properties: {
            videoId: { type: 'string' },
            title: { type: 'string' },
            channelId: { type: 'string' },
            channelName: { type: 'string' },
            publishedAt: { type: 'string' },
            date: { type: 'string' },
            time: { type: 'string' },
            videoType: { type: 'string' },
            videoUrl: { type: 'string' },
          },
        },
        400: errorResponse,
        404: errorResponse,
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { url } = request.query;

    // YouTube URL에서 video ID 추출
    const videoId = extractVideoId(url);
    if (!videoId) {
      return badRequest(reply, '유효하지 않은 YouTube URL입니다.');
    }

    try {
      const video = await fetchVideoInfo(videoId);
      if (!video) {
        return notFound(reply, '영상을 찾을 수 없습니다.');
      }

      return {
        videoId: video.videoId,
        title: video.title,
        channelId: video.channelId,
        channelName: video.channelTitle,
        publishedAt: video.publishedAt,
        date: video.date,
        time: video.time,
        videoType: video.videoType,
        videoUrl: video.videoUrl,
      };
    } catch (err) {
      fastify.log.error(`YouTube 영상 조회 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * POST /api/admin/youtube/schedule
   * YouTube 일정 저장
   */
  fastify.post('/schedule', {
    schema: {
      tags: ['admin/youtube'],
      summary: 'YouTube 일정 저장',
      description: 'YouTube 영상을 일정으로 등록합니다.',
      security: [{ bearerAuth: [] }],
      body: youtubeScheduleCreate,
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
    const { videoId, title, channelId, channelName, date, time, videoType } = request.body;

    try {
      // 중복 체크
      const [existing] = await db.query(
        'SELECT id FROM schedule_youtube WHERE video_id = ?',
        [videoId]
      );
      if (existing.length > 0) {
        return conflict(reply, '이미 등록된 영상입니다.');
      }

      const scheduleId = await withTransaction(db, async connection => {
        // schedules 테이블에 저장
        const [result] = await connection.query(
          'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
          [YOUTUBE_CATEGORY_ID, title, date, time || null]
        );
        const scheduleId = result.insertId;

        // schedule_youtube 테이블에 저장
        await connection.query(
          'INSERT INTO schedule_youtube (schedule_id, video_id, video_type, channel_id, channel_name) VALUES (?, ?, ?, ?, ?)',
          [scheduleId, videoId, videoType || 'video', channelId, channelName]
        );

        // 영상 아카이브에도 적재 (영상 페이지 데이터원 — 카테고리는 봇/제목 기준 추론)
        await archiveVideo(connection, {
          videoId,
          channelId,
          channelName,
          title,
          category: await inferCategory(connection, channelId, title),
          videoType: videoType || 'video',
          publishedAt: `${date} ${time || '00:00:00'}`,
        });
        return scheduleId;
      });

      // Meilisearch 동기화

      await syncScheduleById(meilisearch, db, scheduleId, fastify.redis);

      logActivity(db, { actor: 'admin', action: 'create', category: 'schedule', targetType: 'youtube_schedule', targetId: scheduleId, summary: `YouTube 일정 생성: ${title}` });
      return { success: true, scheduleId };
    } catch (err) {
      fastify.log.error(`YouTube 일정 저장 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * PUT /api/admin/youtube/schedule/:id
   * YouTube 일정 수정 (영상 유형 수정 가능)
   */
  fastify.put('/schedule/:id', {
    schema: {
      tags: ['admin/youtube'],
      summary: 'YouTube 일정 수정',
      description: 'YouTube 일정의 영상 유형을 수정합니다.',
      security: [{ bearerAuth: [] }],
      params: idParam,
      body: youtubeScheduleUpdate,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: errorResponse,
        500: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { videoType } = request.body;

    try {
      // 일정 존재 확인
      const [schedules] = await db.query(
        'SELECT s.id, s.title, s.date, s.time, sy.video_id FROM schedules s LEFT JOIN schedule_youtube sy ON sy.schedule_id = s.id WHERE s.id = ? AND s.category_id = ?',
        [id, YOUTUBE_CATEGORY_ID]
      );
      if (schedules.length === 0) {
        return notFound(reply, 'YouTube 일정을 찾을 수 없습니다.');
      }

      // 영상 유형 수정
      if (videoType) {
        await withTransaction(db, async connection => {
          if (schedules[0].video_id) {
            await updateVideoType(connection, schedules[0].video_id, videoType);
          } else {
            await connection.query('UPDATE schedule_youtube SET video_type = ? WHERE schedule_id = ?', [videoType, id]);
          }
        });
      }

      await syncScheduleById(meilisearch, db, parseInt(id), fastify.redis);

      logActivity(db, { actor: 'admin', action: 'update', category: 'schedule', targetType: 'youtube_schedule', targetId: parseInt(id), summary: `YouTube 일정 수정: ${schedules[0].title}` });
      return { success: true };
    } catch (err) {
      fastify.log.error(`YouTube 일정 수정 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });
}

/**
 * YouTube URL에서 video ID 추출
 */
function extractVideoId(url) {
  if (!url) return null;

  const patterns = [
    // https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // https://youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
