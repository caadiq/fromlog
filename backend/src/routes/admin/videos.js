import { fetchVideoInfo } from '../../services/youtube/api.js';
import { archiveVideo, inferCategory, ARCHIVE_MIN_DATE } from '../../services/videos.js';
import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound, conflict, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

const CATEGORIES = ['official', 'sp', 'variety', 'music'];

/** YouTube URL → videoId */
function extractVideoId(url) {
  const m = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : /^[\w-]{11}$/.test(url) ? url : null;
}

/**
 * 영상 아카이브 관리자 라우트
 * 봇이 못 잡는 영상(설명란 없는 쇼츠 등) 수동 등록과 오분류 개별 수정용.
 */
export default async function videosAdminRoutes(fastify) {
  const { db } = fastify;

  /**
   * GET /api/admin/videos — 목록 (필터·검색·페이징)
   */
  fastify.get('/', {
    schema: {
      tags: ['admin/videos'],
      summary: '영상 아카이브 목록',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          channel: { type: 'string' },
          q: { type: 'string' },
          type: { type: 'string', enum: ['video', 'shorts'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { category, channel, q, type, limit = 30, offset = 0 } = request.query;
    const where = [];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (channel) { where.push('channel_name = ?'); params.push(channel); }
    if (type) { where.push('video_type = ?'); params.push(type); }
    if (q) { where.push('title LIKE ?'); params.push(`%${q}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM videos ${whereSql}`, params);
    const [rows] = await db.query(
      `SELECT video_id, channel_id, channel_name, title, category, video_type, published_at, members
       FROM videos ${whereSql} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [channels] = await db.query(
      'SELECT DISTINCT channel_name FROM videos ORDER BY channel_name'
    );
    return {
      total,
      videos: rows.map((r) => ({
        videoId: r.video_id,
        channelId: r.channel_id,
        channelName: r.channel_name,
        title: r.title,
        category: r.category,
        videoType: r.video_type,
        publishedAt: r.published_at,
        members: r.members || [],
      })),
      channels: channels.map((c) => c.channel_name),
    };
  });

  /**
   * GET /api/admin/videos/preview — URL로 영상 정보 미리보기 (등록 전 확인)
   */
  fastify.get('/preview', {
    schema: {
      tags: ['admin/videos'],
      summary: '영상 정보 미리보기',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const videoId = extractVideoId(request.query.url);
    if (!videoId) return badRequest(reply, '유효하지 않은 YouTube URL입니다.');

    const [existing] = await db.query('SELECT category FROM videos WHERE video_id = ?', [videoId]);
    const info = await fetchVideoInfo(videoId);
    if (!info) return notFound(reply, '영상을 찾을 수 없습니다.');

    const suggestedCategory = await inferCategory(db, info.channelId, info.title);
    return {
      videoId,
      title: info.title,
      channelName: info.channelTitle,
      channelId: info.channelId,
      publishedAt: `${info.date} ${info.time}`,
      videoType: info.videoType,
      suggestedCategory,
      alreadyExists: existing.length > 0,
      existingCategory: existing[0]?.category || null,
      beforeCutoff: info.date < ARCHIVE_MIN_DATE,
    };
  });

  /**
   * POST /api/admin/videos — 수동 등록
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/videos'],
      summary: '영상 수동 등록',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const videoId = extractVideoId(request.body.url);
    if (!videoId) return badRequest(reply, '유효하지 않은 YouTube URL입니다.');

    try {
      const info = await fetchVideoInfo(videoId);
      if (!info) return notFound(reply, '영상을 찾을 수 없습니다.');

      const category =
        request.body.category || (await inferCategory(db, info.channelId, info.title));
      const added = await archiveVideo(db, {
        videoId,
        channelId: info.channelId,
        channelName: info.channelTitle,
        title: info.title,
        category,
        videoType: info.videoType,
        duration: info.duration ?? null,
        publishedAt: `${info.date} ${info.time}`,
      });
      if (!added) {
        // INSERT IGNORE 무시 사유 구분: 중복 vs 5인 체제 컷
        if (info.date < ARCHIVE_MIN_DATE) {
          return badRequest(reply, `5인 체제(${ARCHIVE_MIN_DATE}) 이전 영상은 등록할 수 없습니다.`);
        }
        return conflict(reply, '이미 등록된 영상입니다.');
      }

      logActivity(db, {
        actor: 'admin', action: 'create', category: 'video',
        targetType: 'video', targetId: videoId,
        summary: `영상 수동 등록: ${info.title}`,
      });
      return { success: true, videoId, category };
    } catch (err) {
      fastify.log.error(`영상 수동 등록 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * PUT /api/admin/videos/:videoId — 카테고리·타입 수정
   */
  fastify.put('/:videoId', {
    schema: {
      tags: ['admin/videos'],
      summary: '영상 수정',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['videoId'],
        properties: { videoId: { type: 'string', pattern: '^[\\w-]{11}$' } },
      },
      body: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          video_type: { type: 'string', enum: ['video', 'shorts'] },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { videoId } = request.params;
    const { category, video_type } = request.body;
    if (!category && !video_type) return badRequest(reply, '수정할 항목이 없습니다.');

    const [rows] = await db.query('SELECT title FROM videos WHERE video_id = ?', [videoId]);
    if (rows.length === 0) return notFound(reply, '영상을 찾을 수 없습니다.');

    const sets = [];
    const params = [];
    if (category) { sets.push('category = ?'); params.push(category); }
    if (video_type) { sets.push('video_type = ?'); params.push(video_type); }
    await db.query(`UPDATE videos SET ${sets.join(', ')} WHERE video_id = ?`, [...params, videoId]);

    logActivity(db, {
      actor: 'admin', action: 'update', category: 'video',
      targetType: 'video', targetId: videoId,
      summary: `영상 수정: ${rows[0].title}`,
    });
    return { success: true };
  });

  /**
   * DELETE /api/admin/videos/:videoId
   */
  fastify.delete('/:videoId', {
    schema: {
      tags: ['admin/videos'],
      summary: '영상 삭제',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['videoId'],
        properties: { videoId: { type: 'string', pattern: '^[\\w-]{11}$' } },
      },
      response: { 404: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { videoId } = request.params;
    const [rows] = await db.query('SELECT title FROM videos WHERE video_id = ?', [videoId]);
    if (rows.length === 0) return notFound(reply, '영상을 찾을 수 없습니다.');

    await db.query('DELETE FROM videos WHERE video_id = ?', [videoId]);
    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'video',
      targetType: 'video', targetId: videoId,
      summary: `영상 삭제: ${rows[0].title}`,
    });
    return { success: true };
  });
}
