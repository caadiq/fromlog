import {
  uploadAlbumPhoto,
  deleteAlbumPhoto,
  uploadAlbumVideo,
} from '../../services/image.js';
import { invalidateAlbumCache } from '../../services/album.js';
import { withTransaction } from '../../utils/transaction.js';
import { notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

/**
 * 앨범 사진 라우트
 * GET: 공개, POST/DELETE: 인증 필요
 */
export default async function photosRoutes(fastify) {
  const { db, redis } = fastify;

  /**
   * GET /api/albums/:albumId/photos
   */
  fastify.get('/:albumId/photos', {
    schema: {
      tags: ['albums'],
      summary: '앨범 컨셉 포토 목록',
    },
  }, async (request, reply) => {
    const { albumId } = request.params;

    const [albums] = await db.query('SELECT folder_name FROM albums WHERE id = ?', [albumId]);
    if (albums.length === 0) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }

    const [photos] = await db.query(
      `SELECT
        p.id, p.original_url, p.medium_url, p.thumb_url, p.photo_type, p.concept_name,
        p.sort_order, p.width, p.height, p.file_size,
        GROUP_CONCAT(pm.member_id) as member_ids
      FROM album_photos p
      LEFT JOIN album_photo_members pm ON p.id = pm.photo_id
      WHERE p.album_id = ?
      GROUP BY p.id
      ORDER BY p.sort_order ASC`,
      [albumId]
    );

    return photos.map((photo) => ({
      ...photo,
      members: photo.member_ids ? photo.member_ids.split(',').map(Number) : [],
    }));
  });

  /**
   * POST /api/albums/:albumId/photos (SSE)
   */
  fastify.post('/:albumId/photos', {
    schema: {
      tags: ['albums'],
      summary: '앨범 사진 업로드',
      description: 'SSE로 진행률 반환',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { albumId } = request.params;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendProgress = (current, total, message) => {
      reply.raw.write(`data: ${JSON.stringify({ current, total, message })}\n\n`);
    };

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [albums] = await connection.query('SELECT folder_name FROM albums WHERE id = ?', [albumId]);
      if (albums.length === 0) {
        reply.raw.write(`data: ${JSON.stringify({ error: '앨범을 찾을 수 없습니다.' })}\n\n`);
        reply.raw.end();
        return;
      }

      const folderName = albums[0].folder_name;
      const parts = request.parts();

      let metadata = [];
      let startNumber = null;
      let photoType = 'concept';
      const files = [];

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'photos') {
          const buffer = await part.toBuffer();
          files.push({ buffer, mimetype: part.mimetype });
        } else if (part.fieldname === 'metadata') {
          try {
            metadata = JSON.parse(part.value);
          } catch {
            reply.raw.write(`data: ${JSON.stringify({ error: '잘못된 metadata JSON 형식입니다.' })}\n\n`);
            reply.raw.end();
            return;
          }
        } else if (part.fieldname === 'startNumber') {
          startNumber = parseInt(part.value) || null;
        } else if (part.fieldname === 'photoType') {
          photoType = part.value;
        }
      }

      let nextOrder;
      if (startNumber && startNumber > 0) {
        nextOrder = startNumber;
      } else {
        const [existingPhotos] = await connection.query(
          'SELECT MAX(sort_order) as maxOrder FROM album_photos WHERE album_id = ?',
          [albumId]
        );
        nextOrder = (existingPhotos[0].maxOrder || 0) + 1;
      }

      const uploadedPhotos = [];
      const totalFiles = files.length;
      const subFolder = photoType === 'teaser' ? 'teaser' : 'photo';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = metadata[i] || {};
        const orderNum = String(nextOrder + i).padStart(2, '0');
        const isVideo = file.mimetype === 'video/mp4';
        const filename = `${orderNum}.${isVideo ? 'mp4' : 'webp'}`;

        sendProgress(i + 1, totalFiles, `${filename} 처리 중...`);

        let originalUrl, mediumUrl, thumbUrl, videoUrl;
        let photoMetadata = {};

        if (isVideo) {
          videoUrl = await uploadAlbumVideo(folderName, filename, file.buffer);
          originalUrl = videoUrl;
          mediumUrl = videoUrl;
          thumbUrl = videoUrl;
        } else {
          const result = await uploadAlbumPhoto(folderName, subFolder, filename, file.buffer);
          originalUrl = result.originalUrl;
          mediumUrl = result.mediumUrl;
          thumbUrl = result.thumbUrl;
          photoMetadata = result.metadata;
        }

        let photoId;

        if (photoType === 'teaser') {
          const mediaType = isVideo ? 'video' : 'image';
          const [result] = await connection.query(
            `INSERT INTO album_teasers
             (album_id, original_url, medium_url, thumb_url, video_url, sort_order, media_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [albumId, originalUrl, mediumUrl, thumbUrl, videoUrl || null, nextOrder + i, mediaType]
          );
          photoId = result.insertId;
        } else {
          const [result] = await connection.query(
            `INSERT INTO album_photos
             (album_id, original_url, medium_url, thumb_url, photo_type, concept_name, sort_order, width, height, file_size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [albumId, originalUrl, mediumUrl, thumbUrl, meta.groupType || 'group',
             meta.conceptName || null, nextOrder + i, photoMetadata.width || null,
             photoMetadata.height || null, photoMetadata.size || null]
          );
          photoId = result.insertId;

          if (meta.members && meta.members.length > 0) {
            const values = meta.members.map(memberId => [photoId, memberId]);
            await connection.query(
              'INSERT INTO album_photo_members (photo_id, member_id) VALUES ?',
              [values]
            );
          }
        }

        uploadedPhotos.push({
          id: photoId,
          original_url: originalUrl,
          medium_url: mediumUrl,
          thumb_url: thumbUrl,
          video_url: videoUrl || null,
          filename,
          media_type: isVideo ? 'video' : 'image',
        });
      }

      await connection.commit();

      // 앨범 캐시 무효화
      await invalidateAlbumCache(redis, parseInt(albumId));

      logActivity(db, { actor: 'admin', action: 'upload', category: 'album', targetType: 'photo', targetId: parseInt(albumId), summary: `사진 업로드: ${uploadedPhotos.length}장 (앨범 ${albumId})` });

      reply.raw.write(`data: ${JSON.stringify({
        done: true,
        message: `${uploadedPhotos.length}개의 사진이 업로드되었습니다.`,
        photos: uploadedPhotos,
      })}\n\n`);
      reply.raw.end();
    } catch (error) {
      await connection.rollback();
      fastify.log.error(`사진 업로드 오류: ${error.message}`);
      reply.raw.write(`data: ${JSON.stringify({ error: '사진 업로드 중 오류가 발생했습니다.' })}\n\n`);
      reply.raw.end();
    } finally {
      connection.release();
    }
  });

  /**
   * PUT /api/albums/:albumId/photos/bulk-update
   * 등록된 컨셉 포토의 순서·타입·컨셉명·멤버 일괄 수정
   */
  fastify.put('/:albumId/photos/bulk-update', {
    schema: {
      tags: ['albums'],
      summary: '컨셉 포토 일괄 수정 (순서/타입/컨셉명/멤버)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['photos'],
        properties: {
          photos: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'sort_order'],
              properties: {
                id: { type: 'integer' },
                sort_order: { type: 'integer' },
                photo_type: { type: 'string', enum: ['group', 'unit', 'solo'] },
                concept_name: { type: ['string', 'null'] },
                members: { type: 'array', items: { type: 'integer' } },
              },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { albumId } = request.params;
    const { photos } = request.body;

    const [albums] = await db.query('SELECT id FROM albums WHERE id = ?', [albumId]);
    if (albums.length === 0) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }

    await withTransaction(db, async (connection) => {
      for (const p of photos) {
        await connection.query(
          `UPDATE album_photos
           SET sort_order = ?, photo_type = ?, concept_name = ?
           WHERE id = ? AND album_id = ?`,
          [p.sort_order, p.photo_type || 'group', p.concept_name || null, p.id, albumId]
        );
        await connection.query('DELETE FROM album_photo_members WHERE photo_id = ?', [p.id]);
        if (p.members && p.members.length > 0) {
          const values = p.members.map((memberId) => [p.id, memberId]);
          await connection.query(
            'INSERT INTO album_photo_members (photo_id, member_id) VALUES ?',
            [values]
          );
        }
      }
    });

    await invalidateAlbumCache(redis, parseInt(albumId));
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'album', targetType: 'photo',
      targetId: parseInt(albumId),
      summary: `컨셉 포토 일괄 수정: ${photos.length}장 (앨범 ${albumId})`,
    });

    return { message: `${photos.length}장의 사진이 수정되었습니다.` };
  });

  /**
   * GET /api/albums/photos/x-image?scheduleId=&index=
   * X 게시물 일정의 이미지를 원본 화질로 프록시 (pbs.twimg.com은 CORS로
   * 브라우저에서 직접 못 받으므로 서버가 대신 받아 스트림)
   */
  fastify.get('/photos/x-image', {
    schema: {
      tags: ['albums'],
      summary: 'X 게시물 이미지 프록시 (원본 화질)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['scheduleId', 'index'],
        properties: {
          scheduleId: { type: 'integer' },
          index: { type: 'integer' },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { scheduleId, index } = request.query;

    const [xRows] = await db.query(
      'SELECT image_urls FROM schedule_x WHERE schedule_id = ?',
      [scheduleId]
    );
    if (xRows.length === 0) {
      return notFound(reply, '해당 일정의 X 게시물을 찾을 수 없습니다.');
    }
    const imageUrls = xRows[0].image_urls ? JSON.parse(xRows[0].image_urls) : [];
    if (index < 0 || index >= imageUrls.length) {
      return notFound(reply, '해당 인덱스의 이미지가 없습니다.');
    }

    const url = imageUrls[index];
    const origUrl = url.replace(/\.(jpg|jpeg|png)$/i, '') + '?format=jpg&name=orig';

    // pbs.twimg.com(트위터 이미지 CDN)은 간헐적으로 hang/실패함(타임아웃 없으면
    // fetch가 무한 대기 → 프론트 "가져오는 중..." 고착). 타임아웃 + 예외 처리로 감쌈.
    async function fetchImage(target, timeout) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(target, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal,
        });
        if (!res.ok) return null;
        return {
          buffer: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get('content-type') || 'image/jpeg',
        };
      } catch {
        return null; // 타임아웃(AbortError)·네트워크 오류
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // 원본 화질(orig)만 사용 — 저화질 폴백 금지. CDN이 플래핑하므로 재시도로 좋은 순간을 노림.
    let image = null;
    for (let attempt = 0; attempt < 4 && !image; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
      image = await fetchImage(origUrl, 7000);
    }
    if (!image) {
      return notFound(
        reply,
        '트위터 이미지 서버(pbs.twimg.com)가 원본 화질을 일시적으로 제공하지 못하고 있습니다. 트위터 CDN 장애로 보이니 잠시 후 다시 시도해 주세요.'
      );
    }
    reply
      .header('Content-Type', image.contentType)
      .header('X-Image-Count', String(imageUrls.length));
    return reply.send(image.buffer);
  });

  /**
   * DELETE /api/albums/:albumId/photos/:photoId
   */
  fastify.delete('/:albumId/photos/:photoId', {
    schema: {
      tags: ['albums'],
      summary: '컨셉 포토 삭제',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { albumId, photoId } = request.params;

    // 사진 존재 여부 먼저 확인
    const [photos] = await db.query(
      `SELECT p.*, a.folder_name
       FROM album_photos p
       JOIN albums a ON p.album_id = a.id
       WHERE p.id = ? AND p.album_id = ?`,
      [photoId, albumId]
    );

    if (photos.length === 0) {
      return notFound(reply, '사진을 찾을 수 없습니다.');
    }

    const photo = photos[0];
    const filename = photo.original_url.split('/').pop();

    return withTransaction(db, async (connection) => {
      await deleteAlbumPhoto(photo.folder_name, 'photo', filename);
      await connection.query('DELETE FROM album_photo_members WHERE photo_id = ?', [photoId]);
      await connection.query('DELETE FROM album_photos WHERE id = ?', [photoId]);

      // 앨범 캐시 무효화
      await invalidateAlbumCache(redis, parseInt(albumId));

      logActivity(db, { actor: 'admin', action: 'delete', category: 'album', targetType: 'photo', targetId: parseInt(photoId), summary: `사진 삭제: 앨범 ${albumId}` });
      return { message: '사진이 삭제되었습니다.' };
    });
  });
}
