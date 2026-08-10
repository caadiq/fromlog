/**
 * 통계 라우트
 * 인증 필요
 */
import { serverError } from '../../utils/error.js';

export default async function statsRoutes(fastify, opts) {
  const { db } = fastify;

  /**
   * GET /api/stats
   * 대시보드 통계 조회 (인증 필요)
   */
  fastify.get('/', {
    schema: {
      tags: ['stats'],
      summary: '대시보드 통계 조회',
      description: '멤버, 앨범, 사진, 일정, 트랙 수를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            members: { type: 'integer', description: '활동 중인 멤버 수' },
            albums: { type: 'integer', description: '앨범 수' },
            photos: { type: 'integer', description: '사진 수 (컨셉포토 + 티저)' },
            schedules: { type: 'integer', description: '전체 일정 수' },
            tracks: { type: 'integer', description: '트랙 수' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      // 멤버 수 (현재 활동 중인 멤버만)
      const [[{ memberCount }]] = await db.query(
        'SELECT COUNT(*) as memberCount FROM members WHERE is_former = 0'
      );

      // 앨범 수
      const [[{ albumCount }]] = await db.query(
        'SELECT COUNT(*) as albumCount FROM albums'
      );

      // 컨셉 포토 수
      const [[{ photoCount }]] = await db.query(
        'SELECT COUNT(*) as photoCount FROM album_photos'
      );

      // 티저 수
      const [[{ teaserCount }]] = await db.query(
        'SELECT COUNT(*) as teaserCount FROM album_teasers'
      );

      // 일정 수 (전체)
      const [[{ scheduleCount }]] = await db.query(
        'SELECT COUNT(*) as scheduleCount FROM schedules'
      );

      // 트랙 수
      const [[{ trackCount }]] = await db.query(
        'SELECT COUNT(*) as trackCount FROM album_tracks'
      );

      return {
        members: memberCount,
        albums: albumCount,
        photos: photoCount + teaserCount,
        schedules: scheduleCount,
        tracks: trackCount,
      };
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '통계 조회 실패');
    }
  });
}
