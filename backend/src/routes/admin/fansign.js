/**
 * 팬사인회 일정 생성/수정 라우트
 * format: 'offline'(대면) | 'online'(영상통화) | 'both'(대면+영상통화)
 * 주최(음반점)는 host에, 장소는 venue_id에 저장한다.
 * 장소는 선택 — 비공개 팬사인회는 당첨자 개별 안내라 없고, 공개 팬사인회만 공지에 나온다.
 */
import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';
import { withTransaction } from '../../utils/transaction.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';
import { upsertVenue, geocodeVenue } from '../../services/event.js';
import { CATEGORY_IDS } from '../../config/index.js';

const fansignBody = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    date: { type: 'string' },
    time: { type: ['string', 'null'] },
    format: { type: 'string', enum: ['offline', 'online', 'both'], default: 'offline' },
    host: { type: ['string', 'null'], maxLength: 100 },
    // 장소 검색으로 고르면 객체, 이름만 알면 venueName (서버가 지오코딩)
    venue: { type: ['object', 'null'], additionalProperties: true },
    venueName: { type: ['string', 'null'] },
    postUrls: { type: 'array', items: { type: 'string' }, default: [] },
  },
  required: ['title', 'date'],
};

/** 좌표까지 고른 장소는 그대로, 이름만 온 것은 카카오로 찾아본다 (기타·행사와 같은 방식) */
async function resolveVenue(body) {
  if (body.venue?.lat) return body.venue;
  if (body.venue?.id) return body.venue;
  const name = (body.venueName || body.venue?.name || '').trim();
  return name ? await geocodeVenue(name) : null;
}

export default async function fansignAdminRoutes(fastify) {
  const { db, meilisearch, redis } = fastify;

  /**
   * POST /api/admin/fansign — 팬사인회 생성
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/fansign'],
      summary: '팬사인회 생성',
      security: [{ bearerAuth: [] }],
      body: fansignBody,
      response: { 201: { type: 'object', additionalProperties: true }, 400: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { title, date, time = null, format = 'offline', host = null, postUrls = [] } = request.body;
    if (!title?.trim()) return badRequest(reply, '제목은 필수입니다.');
    if (!date) return badRequest(reply, '날짜는 필수입니다.');

    const cleanUrls = postUrls.map((u) => u.trim()).filter(Boolean);
    const venue = await resolveVenue(request.body);

    const scheduleId = await withTransaction(db, async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
        [CATEGORY_IDS.FANSIGN, title.trim(), date, time || null]
      );
      const sid = result.insertId;

      await conn.query(
        'INSERT INTO schedule_fansign (schedule_id, format, host, venue_id, post_urls) VALUES (?, ?, ?, ?, ?)',
        [
          sid, format, host?.trim() || null,
          venue ? await upsertVenue(conn, venue) : null,
          cleanUrls.length > 0 ? JSON.stringify(cleanUrls) : null,
        ]
      );

      return sid;
    });

    await syncScheduleById(meilisearch, db, scheduleId, redis);
    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'fansign_schedule', targetId: scheduleId,
      summary: `팬사인회 생성: ${title.trim()}`,
    });

    reply.code(201);
    return { success: true, scheduleId };
  });

  /**
   * PUT /api/admin/fansign/:id — 팬사인회 수정
   */
  fastify.put('/:id', {
    schema: {
      tags: ['admin/fansign'],
      summary: '팬사인회 수정',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
      body: fansignBody,
      response: { 200: { type: 'object', additionalProperties: true }, 404: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { title, date, time = null, format = 'offline', host = null, postUrls = [] } = request.body;
    if (!title?.trim()) return badRequest(reply, '제목은 필수입니다.');

    const cleanUrls = postUrls.map((u) => u.trim()).filter(Boolean);
    const venue = await resolveVenue(request.body);

    const [existing] = await db.query('SELECT schedule_id FROM schedule_fansign WHERE schedule_id = ?', [id]);
    if (existing.length === 0) return notFound(reply, '팬사인회 일정을 찾을 수 없습니다.');

    await withTransaction(db, async (conn) => {
      await conn.query(
        'UPDATE schedules SET title = ?, date = ?, time = ? WHERE id = ?',
        [title.trim(), date, time || null, id]
      );
      await conn.query(
        'UPDATE schedule_fansign SET format = ?, host = ?, venue_id = ?, post_urls = ? WHERE schedule_id = ?',
        [
          format, host?.trim() || null,
          venue ? await upsertVenue(conn, venue) : null,
          cleanUrls.length > 0 ? JSON.stringify(cleanUrls) : null, id,
        ]
      );
    });

    await syncScheduleById(meilisearch, db, parseInt(id), redis);
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'fansign_schedule', targetId: parseInt(id),
      summary: `팬사인회 수정: ${title.trim()}`,
    });

    return { success: true };
  });
}
