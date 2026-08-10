import { CATEGORY_IDS } from '../../config/index.js';
import { uploadVarietyThumbnail } from '../../services/image.js';
import { addOrUpdateSchedule, syncScheduleById } from '../../services/meilisearch/index.js';
import { badRequest, notFound, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

const VARIETY_CATEGORY_ID = CATEGORY_IDS.VARIETY;
const BROADCASTER_KEY = 'variety:broadcasters';

/**
 * 예능 관련 관리자 라우트
 */
export default async function varietyRoutes(fastify) {
  const { db, meilisearch, redis } = fastify;

  /**
   * GET /api/admin/variety/broadcasters
   * 자주 사용된 방송사/플랫폼 목록 (상위 10개)
   */
  fastify.get('/broadcasters', {
    preHandler: [fastify.authenticate],
  }, async () => {
    // Redis에 캐시가 있으면 사용
    const cached = await redis.get(BROADCASTER_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // DB에서 빈도수 조회
    const [rows] = await db.query(
      `SELECT broadcaster, COUNT(*) as cnt
       FROM schedule_variety
       GROUP BY broadcaster
       ORDER BY cnt DESC
       LIMIT 10`
    );

    const broadcasters = rows.map(r => r.broadcaster);

    // Redis 캐시 (1시간)
    await redis.setex(BROADCASTER_KEY, 3600, JSON.stringify(broadcasters));

    return broadcasters;
  });

  /**
   * POST /api/admin/variety/schedule
   * 예능 일정 저장 (multipart/form-data)
   */
  fastify.post('/schedule', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parts = request.parts();

    let title = '';
    let date = '';
    let time = null;
    let broadcaster = '';
    let replayUrl = null;
    let thumbnailBuffer = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'thumbnail') {
        thumbnailBuffer = await part.toBuffer();
      } else if (part.type === 'field') {
        if (part.fieldname === 'title') title = part.value;
        else if (part.fieldname === 'date') date = part.value;
        else if (part.fieldname === 'time') time = part.value || null;
        else if (part.fieldname === 'broadcaster') broadcaster = part.value;
        else if (part.fieldname === 'replayUrl') replayUrl = part.value || null;
      }
    }

    if (!title?.trim()) return badRequest(reply, '프로그램명은 필수입니다.');
    if (!date) return badRequest(reply, '날짜는 필수입니다.');
    if (!broadcaster?.trim()) return badRequest(reply, '방송사/플랫폼은 필수입니다.');

    try {
      // schedules 테이블
      const [scheduleResult] = await db.query(
        'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
        [VARIETY_CATEGORY_ID, title.trim(), date, time]
      );
      const scheduleId = scheduleResult.insertId;

      // 썸네일 업로드
      let thumbnailId = null;
      if (thumbnailBuffer && thumbnailBuffer.length > 0) {
        const { originalUrl, mediumUrl, thumbUrl } = await uploadVarietyThumbnail(scheduleId, thumbnailBuffer);
        const [imgResult] = await db.query(
          'INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)',
          [originalUrl, mediumUrl, thumbUrl]
        );
        thumbnailId = imgResult.insertId;
      }

      // schedule_variety 테이블
      await db.query(
        'INSERT INTO schedule_variety (schedule_id, broadcaster, replay_url, thumbnail_id) VALUES (?, ?, ?, ?)',
        [scheduleId, broadcaster.trim(), replayUrl?.trim() || null, thumbnailId]
      );

      // Meilisearch 동기화
      const [categoryRows] = await db.query('SELECT name, color FROM schedule_categories WHERE id = ?', [VARIETY_CATEGORY_ID]);
      const category = categoryRows[0] || {};
      await addOrUpdateSchedule(meilisearch, {
        id: scheduleId,
        title: title.trim(),
        date,
        time: time || '',
        category_id: VARIETY_CATEGORY_ID,
        category_name: category.name || '',
        category_color: category.color || '',
      }, redis);

      // 방송사 캐시 무효화
      await redis.del(BROADCASTER_KEY);

      logActivity(db, { actor: 'admin', action: 'create', category: 'schedule', targetType: 'variety_schedule', targetId: scheduleId, summary: `예능 일정 생성: ${title.trim()}` });
      return { success: true, scheduleId };
    } catch (err) {
      fastify.log.error(`예능 일정 저장 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * PUT /api/admin/variety/schedule/:id
   * 예능 일정 수정 (multipart/form-data)
   */
  fastify.put('/schedule/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parts = request.parts();

    let title = '';
    let date = '';
    let time = null;
    let broadcaster = '';
    let replayUrl = null;
    let thumbnailBuffer = null;
    let removeThumbnail = false;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'thumbnail') {
        thumbnailBuffer = await part.toBuffer();
      } else if (part.type === 'field') {
        if (part.fieldname === 'title') title = part.value;
        else if (part.fieldname === 'date') date = part.value;
        else if (part.fieldname === 'time') time = part.value || null;
        else if (part.fieldname === 'broadcaster') broadcaster = part.value;
        else if (part.fieldname === 'replayUrl') replayUrl = part.value || null;
        else if (part.fieldname === 'removeThumbnail') removeThumbnail = part.value === 'true';
      }
    }

    if (!title?.trim()) return badRequest(reply, '프로그램명은 필수입니다.');

    try {
      const [existing] = await db.query('SELECT id FROM schedules WHERE id = ?', [id]);
      if (existing.length === 0) return notFound(reply, '일정을 찾을 수 없습니다.');

      // schedules 업데이트
      await db.query('UPDATE schedules SET title = ?, date = ?, time = ? WHERE id = ?', [title.trim(), date, time, id]);

      // 기존 variety 데이터 조회
      const [varietyRows] = await db.query('SELECT thumbnail_id FROM schedule_variety WHERE schedule_id = ?', [id]);
      let thumbnailId = varietyRows[0]?.thumbnail_id || null;

      // 썸네일 업데이트
      if (thumbnailBuffer && thumbnailBuffer.length > 0) {
        const { originalUrl, mediumUrl, thumbUrl } = await uploadVarietyThumbnail(id, thumbnailBuffer);
        if (thumbnailId) {
          await db.query('UPDATE images SET original_url = ?, medium_url = ?, thumb_url = ? WHERE id = ?', [originalUrl, mediumUrl, thumbUrl, thumbnailId]);
        } else {
          const [imgResult] = await db.query('INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)', [originalUrl, mediumUrl, thumbUrl]);
          thumbnailId = imgResult.insertId;
        }
      } else if (removeThumbnail && thumbnailId) {
        await db.query('DELETE FROM images WHERE id = ?', [thumbnailId]);
        thumbnailId = null;
      }

      // schedule_variety upsert
      if (varietyRows.length > 0) {
        await db.query('UPDATE schedule_variety SET broadcaster = ?, replay_url = ?, thumbnail_id = ? WHERE schedule_id = ?',
          [broadcaster?.trim() || '', replayUrl?.trim() || null, thumbnailId, id]);
      } else {
        await db.query('INSERT INTO schedule_variety (schedule_id, broadcaster, replay_url, thumbnail_id) VALUES (?, ?, ?, ?)',
          [id, broadcaster?.trim() || '', replayUrl?.trim() || null, thumbnailId]);
      }

      await syncScheduleById(meilisearch, db, parseInt(id), redis);
      await redis.del(BROADCASTER_KEY);
      logActivity(db, { actor: 'admin', action: 'update', category: 'schedule', targetType: 'variety_schedule', targetId: parseInt(id), summary: `예능 일정 수정: ${title.trim()}` });
      return { success: true };
    } catch (err) {
      fastify.log.error(`예능 일정 수정 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * GET /api/admin/variety/schedule/:id
   * 예능 일정 상세 조회 (수정 폼용)
   */
  fastify.get('/schedule/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const [rows] = await db.query(`
        SELECT s.id, s.title, s.date, s.time,
               sv.broadcaster, sv.replay_url, sv.thumbnail_id,
               i.original_url as thumb_original, i.medium_url as thumb_medium, i.thumb_url as thumb_thumb
        FROM schedules s
        LEFT JOIN schedule_variety sv ON s.id = sv.schedule_id
        LEFT JOIN images i ON sv.thumbnail_id = i.id
        WHERE s.id = ?
      `, [id]);

      if (rows.length === 0) return notFound(reply, '일정을 찾을 수 없습니다.');

      const s = rows[0];

      return {
        id: s.id,
        title: s.title,
        date: s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date?.split('T')[0] || '',
        time: s.time ? s.time.substring(0, 5) : '',
        broadcaster: s.broadcaster || '',
        replayUrl: s.replay_url || '',
        thumbnailUrl: s.thumb_medium || s.thumb_original || '',
      };
    } catch (err) {
      fastify.log.error(`예능 일정 조회 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });
}
