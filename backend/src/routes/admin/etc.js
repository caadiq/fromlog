import { CATEGORY_IDS } from '../../config/index.js';
import { parseJsonColumn } from '../../utils/json.js';
import { withTransaction } from '../../utils/transaction.js';
import { uploadEtcPoster } from '../../services/image.js';
import { upsertVenue } from '../../services/event.js';
import { logActivity } from '../../utils/log.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';

const ETC_CATEGORY_ID = CATEGORY_IDS.ETC;

/**
 * multipart에서 payload(JSON 문자열) + poster 파일들 추출
 */
async function parseMultipartEtcForm(request) {
  const parts = request.parts();
  let payload = null;
  const posterFiles = [];

  for await (const part of parts) {
    if (part.type === 'file') {
      const buf = await part.toBuffer();
      posterFiles.push({
        filename: part.filename,
        buffer: buf,
        mimetype: part.mimetype,
      });
    } else if (part.fieldname === 'payload') {
      payload = JSON.parse(part.value);
    }
  }

  return { payload, posterFiles };
}

/**
 * images 테이블에 INSERT 후 id 반환
 */
async function saveImageRecord(db, { originalUrl, mediumUrl, thumbUrl }) {
  const [result] = await db.query(
    `INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)`,
    [originalUrl, mediumUrl, thumbUrl]
  );
  return result.insertId;
}

/**
 * 기타(공용) 일정 관리자 라우트 — 라디오·뮤지컬 등 잡다한 출연.
 * 장소·포스터는 선택, 설명 지원. 행사(events.js)와 대칭 구조.
 */
export default async function etcRoutes(fastify) {
  const { db, meilisearch } = fastify;

  /**
   * GET /api/admin/etc/:id — 기타 상세 (수정 폼용)
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [rows] = await db.query(`
      SELECT s.id, s.title, s.date, s.time,
             se.venue_id, se.description, se.post_urls, se.poster_image_ids,
             ev.name as venue_name, ev.address as venue_address,
             ev.road_address as venue_road_address, ev.lat as venue_lat, ev.lng as venue_lng,
             ev.kakao_id as venue_kakao_id
      FROM schedules s
      JOIN schedule_etc se ON s.id = se.schedule_id
      LEFT JOIN event_venues ev ON se.venue_id = ev.id
      WHERE s.id = ?
    `, [id]);

    if (rows.length === 0) {
      return reply.code(404).send({ error: '일정을 찾을 수 없습니다.' });
    }

    const r = rows[0];

    const posterIds = r.poster_image_ids ? parseJsonColumn(r.poster_image_ids) : [];
    let posters = [];
    if (posterIds.length > 0) {
      const [posterRows] = await db.query(
        `SELECT id, original_url, medium_url, thumb_url FROM images WHERE id IN (?) ORDER BY FIELD(id, ?)`,
        [posterIds, posterIds]
      );
      posters = posterRows.map(p => ({
        id: p.id,
        originalUrl: p.original_url,
        mediumUrl: p.medium_url,
        thumbUrl: p.thumb_url,
      }));
    }

    const date = r.date instanceof Date
      ? r.date.toISOString().split('T')[0]
      : String(r.date).split('T')[0];

    return {
      id: r.id,
      title: r.title,
      date,
      time: r.time ? r.time.substring(0, 5) : '',
      description: r.description || '',
      venue: r.venue_id ? {
        id: r.venue_id,
        name: r.venue_name,
        address: r.venue_address,
        roadAddress: r.venue_road_address,
        lat: r.venue_lat,
        lng: r.venue_lng,
        kakao_id: r.venue_kakao_id,
      } : null,
      postUrls: r.post_urls ? parseJsonColumn(r.post_urls) : [],
      posters,
    };
  });

  /**
   * POST /api/admin/etc — 기타 생성 (multipart: payload + poster 파일들)
   */
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { payload, posterFiles } = await parseMultipartEtcForm(request);

    if (!payload) {
      return reply.code(400).send({ error: 'payload가 필요합니다.' });
    }

    const { title, date, time, description = '', venue = null, postUrls = [] } = payload;

    if (!title || !date) {
      return reply.code(400).send({ error: '제목/날짜는 필수입니다.' });
    }

    const scheduleId = await withTransaction(db, async (conn) => {
      const venueId = venue ? await upsertVenue(conn, venue) : null;

      const [sResult] = await conn.query(
        `INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)`,
        [ETC_CATEGORY_ID, title, date, time || null]
      );
      const sid = sResult.insertId;

      await conn.query(
        `INSERT INTO schedule_etc (schedule_id, venue_id, description, post_urls)
         VALUES (?, ?, ?, ?)`,
        [
          sid,
          venueId,
          description || null,
          postUrls.length > 0 ? JSON.stringify(postUrls) : null,
        ]
      );

      return sid;
    });

    // 포스터 업로드 (트랜잭션 밖 — S3 I/O)
    if (posterFiles.length > 0) {
      const uploadedIds = [];
      for (let i = 0; i < posterFiles.length; i++) {
        const ext = (posterFiles[i].filename.split('.').pop() || 'webp').toLowerCase();
        const filename = `${String(i + 1).padStart(2, '0')}.${ext === 'jpg' ? 'jpeg' : ext}`;
        const urls = await uploadEtcPoster(scheduleId, filename, posterFiles[i].buffer);
        const imgId = await saveImageRecord(db, urls);
        uploadedIds.push(imgId);
      }
      await db.query(
        `UPDATE schedule_etc SET poster_image_ids = ? WHERE schedule_id = ?`,
        [JSON.stringify(uploadedIds), scheduleId]
      );
    }

    await syncScheduleById(meilisearch, db, scheduleId, fastify.redis);

    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'etc_schedule', targetId: scheduleId,
      summary: `기타 생성: ${title}`,
    });

    reply.code(201);
    return { id: scheduleId };
  });

  /**
   * PUT /api/admin/etc/:id — 기타 수정 (multipart: payload + 새 poster 파일들)
   * payload.keepPosterIds: 유지할 기존 포스터 ID 배열 (순서대로)
   */
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { payload, posterFiles } = await parseMultipartEtcForm(request);

    if (!payload) {
      return reply.code(400).send({ error: 'payload가 필요합니다.' });
    }

    const [existing] = await db.query('SELECT schedule_id FROM schedule_etc WHERE schedule_id = ?', [id]);
    if (existing.length === 0) {
      return reply.code(404).send({ error: '일정을 찾을 수 없습니다.' });
    }

    const { title, date, time, description = '', venue = null, postUrls = [], keepPosterIds = [] } = payload;

    await withTransaction(db, async (conn) => {
      await conn.query(
        `UPDATE schedules SET title = ?, date = ?, time = ? WHERE id = ?`,
        [title, date, time || null, id]
      );

      const venueId = venue ? await upsertVenue(conn, venue) : null;

      await conn.query(
        `UPDATE schedule_etc
         SET venue_id = ?, description = ?, post_urls = ?
         WHERE schedule_id = ?`,
        [
          venueId,
          description || null,
          postUrls.length > 0 ? JSON.stringify(postUrls) : null,
          id,
        ]
      );
    });

    // 포스터: 새 파일 업로드 후 keepPosterIds + 새 id 순서로 저장
    const newIds = [];
    for (let i = 0; i < posterFiles.length; i++) {
      const ext = (posterFiles[i].filename.split('.').pop() || 'webp').toLowerCase();
      const filename = `${Date.now()}_${i}.${ext === 'jpg' ? 'jpeg' : ext}`;
      const urls = await uploadEtcPoster(id, filename, posterFiles[i].buffer);
      const imgId = await saveImageRecord(db, urls);
      newIds.push(imgId);
    }
    const finalIds = [...keepPosterIds, ...newIds];
    await db.query(
      `UPDATE schedule_etc SET poster_image_ids = ? WHERE schedule_id = ?`,
      [finalIds.length > 0 ? JSON.stringify(finalIds) : null, id]
    );

    await syncScheduleById(meilisearch, db, parseInt(id), fastify.redis);

    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'etc_schedule', targetId: parseInt(id),
      summary: `기타 수정: ${title}`,
    });

    return { id: parseInt(id) };
  });

  /**
   * DELETE /api/admin/etc/:id
   */
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.query('SELECT s.title FROM schedules s JOIN schedule_etc se ON s.id = se.schedule_id WHERE s.id = ?', [id]);
    if (existing.length === 0) {
      return reply.code(404).send({ error: '일정을 찾을 수 없습니다.' });
    }

    // schedules CASCADE로 schedule_etc도 정리됨
    await db.query('DELETE FROM schedules WHERE id = ?', [id]);

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'schedule',
      targetType: 'etc_schedule', targetId: parseInt(id),
      summary: `기타 삭제: ${existing[0].title}`,
    });

    return { success: true };
  });
}
