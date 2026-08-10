/**
 * 일반 일정 생성/수정 라우트 (전용 폼이 없는 단순 카테고리용 — 컴백·팬사인회·기타)
 * 제목·날짜·시간·멤버 + date_precision(컴백의 "날짜 미정"). 이미지/장소/설명은 미지원.
 */
import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';

const scheduleBody = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    date: { type: 'string' }, // YYYY-MM-DD
    time: { type: ['string', 'null'] },
    category: { type: 'integer' },
    datePrecision: { type: 'string', enum: ['day', 'month'], default: 'day' },
  },
  required: ['title', 'date', 'category'],
};

/**
 * date_precision이 month면 날짜를 해당 월 1일로 정규화
 */
function normalizeDate(date, precision) {
  if (precision === 'month' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date.slice(0, 7)}-01`;
  }
  return date;
}

export default async function schedulesAdminRoutes(fastify) {
  const { db, meilisearch, redis } = fastify;

  /**
   * POST /api/admin/schedules — 일정 생성
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/schedules'],
      summary: '일반 일정 생성',
      security: [{ bearerAuth: [] }],
      body: scheduleBody,
      response: { 201: { type: 'object', additionalProperties: true }, 400: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { title, date, time = null, category, datePrecision = 'day' } = request.body;
    if (!title?.trim()) return badRequest(reply, '제목은 필수입니다.');
    if (!date) return badRequest(reply, '날짜는 필수입니다.');

    const finalDate = normalizeDate(date, datePrecision);

    const [result] = await db.query(
      'INSERT INTO schedules (category_id, title, date, time, date_precision) VALUES (?, ?, ?, ?, ?)',
      [category, title.trim(), finalDate, time || null, datePrecision]
    );
    const scheduleId = result.insertId;

    await syncScheduleById(meilisearch, db, scheduleId, redis);
    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'schedule', targetId: scheduleId,
      summary: `일정 생성: ${title.trim()}`,
    });

    reply.code(201);
    return { success: true, scheduleId };
  });

  /**
   * PUT /api/admin/schedules/:id — 일정 수정
   */
  fastify.put('/:id', {
    schema: {
      tags: ['admin/schedules'],
      summary: '일반 일정 수정',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
      body: scheduleBody,
      response: { 200: { type: 'object', additionalProperties: true }, 404: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { title, date, time = null, category, datePrecision = 'day' } = request.body;
    if (!title?.trim()) return badRequest(reply, '제목은 필수입니다.');

    const [existing] = await db.query('SELECT id FROM schedules WHERE id = ?', [id]);
    if (existing.length === 0) return notFound(reply, '일정을 찾을 수 없습니다.');

    const finalDate = normalizeDate(date, datePrecision);

    await db.query(
      'UPDATE schedules SET category_id = ?, title = ?, date = ?, time = ?, date_precision = ? WHERE id = ?',
      [category, title.trim(), finalDate, time || null, datePrecision, id]
    );

    await syncScheduleById(meilisearch, db, parseInt(id), redis);
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'schedule', targetId: parseInt(id),
      summary: `일정 수정: ${title.trim()}`,
    });

    return { success: true };
  });

}
