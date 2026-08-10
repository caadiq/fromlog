import {
  getAlbumDetails,
  getAlbumsWithTracks,
  getAlbumByName,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  invalidateAlbumCache,
} from '../../services/album.js';
import photosRoutes from './photos.js';
import teasersRoutes from './teasers.js';
import { errorResponse, successResponse, idParam } from '../../schemas/index.js';
import { notFound, badRequest } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';
import { CATEGORY_IDS } from '../../config/index.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';

/**
 * 앨범 라우트
 * GET: 공개, POST/PUT/DELETE: 인증 필요
 */
export default async function albumsRoutes(fastify) {
  const { db, redis } = fastify;

  // 하위 라우트 등록
  fastify.register(photosRoutes);
  fastify.register(teasersRoutes);

  // ==================== GET (공개) ====================

  /**
   * GET /api/albums
   */
  fastify.get('/', {
    schema: {
      tags: ['albums'],
      summary: '전체 앨범 목록 조회',
      description: '모든 앨범과 트랙 목록을 조회합니다.',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  }, async () => {
    return await getAlbumsWithTracks(db, redis);
  });

  /**
   * GET /api/albums/by-name/:albumName/track/:trackTitle
   */
  fastify.get('/by-name/:albumName/track/:trackTitle', {
    schema: {
      tags: ['albums'],
      summary: '앨범명과 트랙명으로 트랙 조회',
      description: '앨범명(또는 폴더명)과 트랙명으로 트랙 상세 정보를 조회합니다.',
      params: {
        type: 'object',
        properties: {
          albumName: { type: 'string', description: '앨범명 또는 폴더명' },
          trackTitle: { type: 'string', description: '트랙 제목' },
        },
        required: ['albumName', 'trackTitle'],
      },
      response: {
        404: errorResponse,
      },
    },
  }, async (request, reply) => {
    const albumName = decodeURIComponent(request.params.albumName);
    const trackTitle = decodeURIComponent(request.params.trackTitle);

    const album = await getAlbumByName(db, albumName);
    if (!album) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }

    const [tracks] = await db.query(
      'SELECT * FROM album_tracks WHERE album_id = ? AND title = ?',
      [album.id, trackTitle]
    );

    if (tracks.length === 0) {
      return notFound(reply, '트랙을 찾을 수 없습니다.');
    }

    const track = tracks[0];

    const [otherTracks] = await db.query(
      'SELECT id, track_number, title, is_title_track, duration FROM album_tracks WHERE album_id = ? ORDER BY track_number',
      [album.id]
    );

    return {
      ...track,
      album: {
        id: album.id,
        title: album.title,
        folder_name: album.folder_name,
        cover_thumb_url: album.cover_thumb_url,
        cover_medium_url: album.cover_medium_url,
        release_date: album.release_date,
        album_type: album.album_type,
      },
      otherTracks,
    };
  });

  /**
   * GET /api/albums/hero
   * 홈 히어로 슬라이드 — 최신 앨범의 세로형 컨셉 포토 (리뉴얼 홈)
   * 폴백: 세로형 없음 → 아무 컨셉 포토 → 앨범 커버
   */
  fastify.get('/hero', {
    schema: {
      tags: ['albums'],
      summary: '홈 히어로 슬라이드 데이터',
    },
  }, async () => {
    // 컨셉 포토 또는 커버가 있는 최신 앨범
    const [albums] = await db.query(`
      SELECT a.id, a.title, a.folder_name, a.release_date, a.cover_medium_url,
        a.album_type, a.album_type_short,
        (SELECT COUNT(*) FROM album_photos p WHERE p.album_id = a.id) AS photo_count
      FROM albums a
      ORDER BY a.release_date DESC
    `);
    const album = albums.find((a) => a.photo_count > 0 || a.cover_medium_url) || albums[0];
    if (!album) return { album: null, photos: [] };

    // 세로형 우선, 없으면 전체
    const [vertical] = await db.query(
      `SELECT medium_url FROM album_photos
       WHERE album_id = ? AND height > width ORDER BY sort_order LIMIT 30`,
      [album.id]
    );
    let photos = vertical.map((p) => p.medium_url);
    let fit = 'contain';
    if (photos.length === 0) {
      const [any] = await db.query(
        `SELECT medium_url FROM album_photos WHERE album_id = ? ORDER BY sort_order LIMIT 30`,
        [album.id]
      );
      photos = any.map((p) => p.medium_url);
      fit = 'crop'; // 가로형뿐이면 중앙 크롭
    }
    if (photos.length === 0 && album.cover_medium_url) {
      photos = [album.cover_medium_url];
      fit = 'crop';
    }

    return {
      album: {
        id: album.id,
        title: album.title,
        folderName: album.folder_name,
        releaseDate: album.release_date,
        albumType: album.album_type,
        albumTypeShort: album.album_type_short,
      },
      photos,
      fit,
    };
  });

  /**
   * GET /api/albums/by-name/:name
   */
  fastify.get('/by-name/:name', {
    schema: {
      tags: ['albums'],
      summary: '앨범명으로 앨범 조회',
      description: '앨범명(또는 폴더명)으로 앨범 상세 정보를 조회합니다.',
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '앨범명 또는 폴더명' },
        },
        required: ['name'],
      },
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request, reply) => {
    const album = await getAlbumByName(db, decodeURIComponent(request.params.name));
    if (!album) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }
    return getAlbumDetails(db, album, redis);
  });

  /**
   * GET /api/albums/:id
   */
  fastify.get('/:id', {
    schema: {
      tags: ['albums'],
      summary: 'ID로 앨범 조회',
      description: '앨범 ID로 상세 정보(트랙, 티저, 컨셉포토 포함)를 조회합니다.',
      params: idParam,
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request, reply) => {
    const album = await getAlbumById(db, request.params.id);
    if (!album) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }
    return getAlbumDetails(db, album, redis);
  });

  // ==================== POST/PUT/DELETE (인증 필요) ====================

  /**
   * POST /api/albums
   */
  fastify.post('/', {
    schema: {
      tags: ['albums'],
      summary: '앨범 생성',
      description: 'multipart/form-data로 앨범을 생성합니다. data 필드에 JSON, cover 필드에 이미지 파일.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            albumId: { type: 'integer' },
          },
        },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parts = request.parts();
    let data = null;
    let coverBuffer = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'cover') {
        coverBuffer = await part.toBuffer();
      } else if (part.fieldname === 'data') {
        try {
          data = JSON.parse(part.value);
        } catch {
          return badRequest(reply, '잘못된 JSON 형식입니다.');
        }
      }
    }

    if (!data) {
      return badRequest(reply, '데이터가 필요합니다.');
    }

    const { title, album_type, release_date, folder_name } = data;

    if (!title || !album_type || !release_date || !folder_name) {
      return badRequest(reply, '필수 필드를 모두 입력해주세요.');
    }

    const result = await createAlbum(db, data, coverBuffer);
    await invalidateAlbumCache(redis);
    logActivity(db, { actor: 'admin', action: 'create', category: 'album', targetType: 'album', targetId: result.albumId, summary: `앨범 생성: ${title}` });

    // 발매 일정 자동 생성 (앨범 카테고리, 시간은 비움 — 필요 시 일정 관리에서 수정)
    try {
      const scheduleTitle = `${album_type} '${title}' 발매`;
      const [scheduleResult] = await db.query(
        'INSERT INTO schedules (category_id, title, date) VALUES (?, ?, ?)',
        [CATEGORY_IDS.ALBUM, scheduleTitle, release_date]
      );
      await db.query(
        'INSERT INTO schedule_album (schedule_id, album_id) VALUES (?, ?)',
        [scheduleResult.insertId, result.albumId]
      );
      await syncScheduleById(fastify.meilisearch, db, scheduleResult.insertId, redis);
      logActivity(db, {
        actor: 'admin', action: 'create', category: 'schedule',
        targetType: 'album_schedule', targetId: scheduleResult.insertId,
        summary: `앨범 발매 일정 자동 생성: ${scheduleTitle}`,
      });
    } catch (err) {
      // 일정 생성 실패는 앨범 생성 자체를 막지 않음
      fastify.log.error(`앨범 발매 일정 자동 생성 실패: ${err.message}`);
    }

    return result;
  });

  /**
   * PUT /api/albums/:id
   */
  fastify.put('/:id', {
    schema: {
      tags: ['albums'],
      summary: '앨범 수정',
      description: 'multipart/form-data로 앨범을 수정합니다.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      params: idParam,
      response: {
        200: successResponse,
        400: errorResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parts = request.parts();
    let data = null;
    let coverBuffer = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'cover') {
        coverBuffer = await part.toBuffer();
      } else if (part.fieldname === 'data') {
        try {
          data = JSON.parse(part.value);
        } catch {
          return badRequest(reply, '잘못된 JSON 형식입니다.');
        }
      }
    }

    if (!data) {
      return badRequest(reply, '데이터가 필요합니다.');
    }

    const result = await updateAlbum(db, id, data, coverBuffer);
    if (!result) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }
    await invalidateAlbumCache(redis, id);
    logActivity(db, { actor: 'admin', action: 'update', category: 'album', targetType: 'album', targetId: parseInt(id), summary: `앨범 수정: ${data.title || id}` });
    return result;
  });

  /**
   * DELETE /api/albums/:id
   */
  fastify.delete('/:id', {
    schema: {
      tags: ['albums'],
      summary: '앨범 삭제',
      description: '앨범과 관련 데이터(트랙, 커버 이미지)를 삭제합니다.',
      security: [{ bearerAuth: [] }],
      params: idParam,
      response: {
        200: successResponse,
        404: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const result = await deleteAlbum(db, id);
    if (!result) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }
    await invalidateAlbumCache(redis, id);
    logActivity(db, { actor: 'admin', action: 'delete', category: 'album', targetType: 'album', targetId: parseInt(id), summary: `앨범 삭제: ${id}` });
    return result;
  });
}
