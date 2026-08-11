import { CATEGORY_IDS } from '../../config/index.js';
import { parseJsonColumn } from '../../utils/json.js';
import { withTransaction } from '../../utils/transaction.js';
import { uploadEventPoster } from '../../services/image.js';
import { upsertVenue } from '../../services/event.js';
import { logActivity } from '../../utils/log.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';

const EVENT_CATEGORY_ID = CATEGORY_IDS.EVENT;
// university: 대학 축제(학교명 필수) / general: 일반 행사(페스티벌·외부 행사 등)
const VALID_SUBTYPES = ['university', 'general'];

/**
 * multipart에서 payload(JSON 문자열) + poster 파일들 추출
 */
async function parseMultipartEventForm(request) {
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
 * 행사 관련 관리자 라우트
 */
export default async function eventsRoutes(fastify) {
  const { db, meilisearch } = fastify;

  /**
   * GET /api/admin/events/:id
   * 행사 상세 조회 (수정 폼용)
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [rows] = await db.query(`
      SELECT s.id, s.title, s.date, s.time,
             se.subtype, se.school_name, se.venue_id, se.post_urls, se.poster_image_ids,
             ev.name as venue_name, ev.address as venue_address,
             ev.road_address as venue_road_address, ev.lat as venue_lat, ev.lng as venue_lng,
             ev.kakao_id as venue_kakao_id
      FROM schedules s
      JOIN schedule_event se ON s.id = se.schedule_id
      LEFT JOIN event_venues ev ON se.venue_id = ev.id
      WHERE s.id = ?
    `, [id]);

    if (rows.length === 0) {
      return reply.code(404).send({ error: '행사를 찾을 수 없습니다.' });
    }

    const r = rows[0];

    // 포스터 이미지 (순서 유지)
    const posterIds = r.poster_image_ids
      ? parseJsonColumn(r.poster_image_ids)
      : [];
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
      subtype: r.subtype,
      schoolName: r.school_name || '',
      venue: r.venue_id ? {
        id: r.venue_id,
        name: r.venue_name,
        address: r.venue_address,
        roadAddress: r.venue_road_address,
        lat: r.venue_lat,
        lng: r.venue_lng,
        kakao_id: r.venue_kakao_id,
      } : null,
      postUrls: r.post_urls
        ? parseJsonColumn(r.post_urls)
        : [],
      posters,
    };
  });

  /**
   * POST /api/admin/events
   * 행사 생성 (multipart/form-data: payload + poster 파일들)
   */
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { payload, posterFiles } = await parseMultipartEventForm(request);

    if (!payload) {
      return reply.code(400).send({ error: 'payload가 필요합니다.' });
    }

    const {
      title, date, time, subtype = 'university', schoolName,
      venue, postUrls = [],
    } = payload;

    if (!title || !date) {
      return reply.code(400).send({ error: '제목/날짜는 필수입니다.' });
    }
    if (!VALID_SUBTYPES.includes(subtype)) {
      return reply.code(400).send({ error: `알 수 없는 subtype: ${subtype}` });
    }
    if (subtype === 'university' && !schoolName) {
      return reply.code(400).send({ error: '대학 축제는 학교명이 필수입니다.' });
    }
    if (!venue) {
      return reply.code(400).send({ error: '장소가 필요합니다.' });
    }

    const scheduleId = await withTransaction(db, async (conn) => {
      // 1) venue upsert
      const venueId = await upsertVenue(conn, venue);

      // 2) schedules INSERT
      const [sResult] = await conn.query(
        `INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)`,
        [EVENT_CATEGORY_ID, title, date, time || null]
      );
      const sid = sResult.insertId;

      // 3) schedule_event INSERT (poster는 트랜잭션 후 업로드, 그 때 UPDATE)
      await conn.query(
        `INSERT INTO schedule_event (schedule_id, subtype, school_name, venue_id, post_urls)
         VALUES (?, ?, ?, ?, ?)`,
        [
          sid,
          subtype,
          subtype === 'university' ? schoolName : null,
          venueId,
          postUrls.length > 0 ? JSON.stringify(postUrls) : null,
        ]
      );

      return sid;
    });

    // 5) 포스터 업로드 (트랜잭션 밖 — S3 I/O)
    if (posterFiles.length > 0) {
      const uploadedIds = [];
      for (let i = 0; i < posterFiles.length; i++) {
        const ext = (posterFiles[i].filename.split('.').pop() || 'webp').toLowerCase();
        const filename = `${String(i + 1).padStart(2, '0')}.${ext === 'jpg' ? 'jpeg' : ext}`;
        const urls = await uploadEventPoster(scheduleId, filename, posterFiles[i].buffer);
        const imgId = await saveImageRecord(db, urls);
        uploadedIds.push(imgId);
      }
      await db.query(
        `UPDATE schedule_event SET poster_image_ids = ? WHERE schedule_id = ?`,
        [JSON.stringify(uploadedIds), scheduleId]
      );
    }

    // Meilisearch 동기화 + 월별 캐시 무효화
    await syncScheduleById(meilisearch, db, scheduleId, fastify.redis);

    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'event_schedule', targetId: scheduleId,
      summary: `행사 생성: ${title}`,
    });

    reply.code(201);
    return { id: scheduleId };
  });

  /**
   * PUT /api/admin/events/:id
   * 행사 수정 (multipart: payload + 새 poster 파일들)
   * payload.keepPosterIds: 유지할 기존 포스터 ID 배열 (순서대로)
   */
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { payload, posterFiles } = await parseMultipartEventForm(request);

    if (!payload) {
      return reply.code(400).send({ error: 'payload가 필요합니다.' });
    }

    const [existing] = await db.query('SELECT schedule_id, poster_image_ids FROM schedule_event WHERE schedule_id = ?', [id]);
    if (existing.length === 0) {
      return reply.code(404).send({ error: '행사를 찾을 수 없습니다.' });
    }

    const {
      title, date, time, subtype, schoolName,
      venue, postUrls = [], keepPosterIds = [],
    } = payload;

    await withTransaction(db, async (conn) => {
      // schedules UPDATE
      await conn.query(
        `UPDATE schedules SET title = ?, date = ?, time = ? WHERE id = ?`,
        [title, date, time || null, id]
      );

      // venue upsert
      const venueId = venue ? await upsertVenue(conn, venue) : null;

      // schedule_event UPDATE
      await conn.query(
        `UPDATE schedule_event
         SET subtype = ?, school_name = ?, venue_id = ?, post_urls = ?
         WHERE schedule_id = ?`,
        [
          subtype,
          subtype === 'university' ? schoolName : null,
          venueId,
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
      const urls = await uploadEventPoster(id, filename, posterFiles[i].buffer);
      const imgId = await saveImageRecord(db, urls);
      newIds.push(imgId);
    }
    const finalIds = [...keepPosterIds, ...newIds];
    await db.query(
      `UPDATE schedule_event SET poster_image_ids = ? WHERE schedule_id = ?`,
      [finalIds.length > 0 ? JSON.stringify(finalIds) : null, id]
    );

    await syncScheduleById(meilisearch, db, parseInt(id), fastify.redis);

    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'event_schedule', targetId: parseInt(id),
      summary: `행사 수정: ${title}`,
    });

    return { id: parseInt(id) };
  });

  /**
   * DELETE /api/admin/events/:id
   */
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.query('SELECT s.title FROM schedules s JOIN schedule_event se ON s.id = se.schedule_id WHERE s.id = ?', [id]);
    if (existing.length === 0) {
      return reply.code(404).send({ error: '행사를 찾을 수 없습니다.' });
    }

    // schedules CASCADE로 schedule_event/schedule_images도 정리됨
    await db.query('DELETE FROM schedules WHERE id = ?', [id]);

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'schedule',
      targetType: 'event_schedule', targetId: parseInt(id),
      summary: `행사 삭제: ${existing[0].title}`,
    });

    return { success: true };
  });
}
