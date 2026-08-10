import {
  deleteAlbumPhoto,
  deleteAlbumVideo,
} from '../../services/image.js';
import { invalidateAlbumCache } from '../../services/album.js';
import { withTransaction } from '../../utils/transaction.js';
import { notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

/**
 * 앨범 티저 라우트
 * GET: 공개, DELETE: 인증 필요
 */
export default async function teasersRoutes(fastify) {
  const { db, redis } = fastify;

  /**
   * GET /api/albums/:albumId/teasers
   */
  fastify.get('/:albumId/teasers', {
    schema: {
      tags: ['albums'],
      summary: '앨범 티저 목록',
    },
  }, async (request, reply) => {
    const { albumId } = request.params;

    const [albums] = await db.query('SELECT folder_name FROM albums WHERE id = ?', [albumId]);
    if (albums.length === 0) {
      return notFound(reply, '앨범을 찾을 수 없습니다.');
    }

    const [teasers] = await db.query(
      `SELECT id, original_url, medium_url, thumb_url, video_url, sort_order, media_type
       FROM album_teasers
       WHERE album_id = ?
       ORDER BY sort_order ASC`,
      [albumId]
    );

    return teasers;
  });

  /**
   * DELETE /api/albums/:albumId/teasers/:teaserId
   */
  fastify.delete('/:albumId/teasers/:teaserId', {
    schema: {
      tags: ['albums'],
      summary: '티저 삭제',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { albumId, teaserId } = request.params;

    // 티저 존재 여부 먼저 확인
    const [teasers] = await db.query(
      `SELECT t.*, a.folder_name
       FROM album_teasers t
       JOIN albums a ON t.album_id = a.id
       WHERE t.id = ? AND t.album_id = ?`,
      [teaserId, albumId]
    );

    if (teasers.length === 0) {
      return notFound(reply, '티저를 찾을 수 없습니다.');
    }

    const teaser = teasers[0];
    const filename = teaser.original_url.split('/').pop();

    return withTransaction(db, async (connection) => {
      await deleteAlbumPhoto(teaser.folder_name, 'teaser', filename);

      if (teaser.video_url) {
        const videoFilename = teaser.video_url.split('/').pop();
        await deleteAlbumVideo(teaser.folder_name, videoFilename);
      }

      await connection.query('DELETE FROM album_teasers WHERE id = ?', [teaserId]);

      await invalidateAlbumCache(redis, parseInt(albumId));

      logActivity(db, { actor: 'admin', action: 'delete', category: 'album', targetType: 'teaser', targetId: parseInt(teaserId), summary: `티저 삭제: 앨범 ${albumId}` });
      return { message: '티저가 삭제되었습니다.' };
    });
  });
}
