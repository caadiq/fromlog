/**
 * 티켓팅 일정 생성/수정 라우트
 * 선예매(presale)·일반예매(general)를 한 폼에서 세트로 생성 — 각 단계가 개별 일정.
 * 콘서트 시리즈 연결(series_id)은 선택 (팬미팅 등은 연결 없이 생성).
 */
import { errorResponse } from '../../schemas/index.js';
import { badRequest, notFound } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';
import { withTransaction } from '../../utils/transaction.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';
import { CATEGORY_IDS } from '../../config/index.js';

const stageBody = {
  type: 'object',
  properties: {
    date: { type: 'string', format: 'date' },
    time: { type: 'string', pattern: '^\\d{2}:\\d{2}(:\\d{2})?$' },
    purchaseLimit: { type: ['string', 'null'], maxLength: 200 },
  },
  required: ['date', 'time'],
};

const ticketingCreateBody = {
  type: 'object',
  properties: {
    eventName: { type: 'string', minLength: 1, maxLength: 400, description: '공연/행사명 (제목 자동 구성)' },
    vendor: { type: ['string', 'null'], maxLength: 100 },
    ticketUrl: { type: ['string', 'null'] },
    seriesId: { type: ['integer', 'null'], description: '연결할 콘서트 시리즈 (선택)' },
    presaleEnd: { type: ['string', 'null'], description: '선예매 종료 (YYYY-MM-DD HH:MM)' },
    presale: { anyOf: [stageBody, { type: 'null' }], description: '팬클럽 선예매 (선택)' },
    general: { anyOf: [stageBody, { type: 'null' }], description: '일반예매 (선택)' },
    authStart: { type: ['string', 'null'], description: '팬클럽 인증 시작 (YYYY-MM-DD HH:MM)' },
    authEnd: { type: ['string', 'null'] },
    authNote: { type: ['string', 'null'], maxLength: 200 },
    postUrls: { type: 'array', items: { type: 'string' }, default: [] },
  },
  required: ['eventName'],
};

const ticketingUpdateBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    date: { type: 'string', format: 'date' },
    time: { type: 'string', pattern: '^\\d{2}:\\d{2}(:\\d{2})?$' },
    vendor: { type: ['string', 'null'], maxLength: 100 },
    ticketUrl: { type: ['string', 'null'] },
    seriesId: { type: ['integer', 'null'] },
    purchaseLimit: { type: ['string', 'null'], maxLength: 200 },
    presaleEnd: { type: ['string', 'null'] },
    authStart: { type: ['string', 'null'] },
    authEnd: { type: ['string', 'null'] },
    authNote: { type: ['string', 'null'], maxLength: 200 },
    postUrls: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'date', 'time'],
};

const STAGE_LABEL = { presale: '선예매', general: '일반예매' };

export default async function ticketingAdminRoutes(fastify) {
  const { db, meilisearch, redis } = fastify;

  /**
   * GET /api/admin/ticketing/series — 연결 가능한 콘서트 시리즈 목록
   */
  fastify.get('/series', {
    schema: {
      tags: ['admin/ticketing'],
      summary: '콘서트 시리즈 목록 (티켓팅 연결용)',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
  }, async () => {
    const [rows] = await db.query(
      'SELECT id, title FROM concert_series ORDER BY id DESC'
    );
    return rows;
  });

  /**
   * POST /api/admin/ticketing — 티켓팅 세트 생성 (선예매·일반예매 중 입력된 단계만)
   */
  fastify.post('/', {
    schema: {
      tags: ['admin/ticketing'],
      summary: '티켓팅 일정 세트 생성',
      security: [{ bearerAuth: [] }],
      body: ticketingCreateBody,
      response: { 201: { type: 'object', additionalProperties: true }, 400: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const {
      eventName, vendor = null, ticketUrl = null, seriesId = null,
      presale = null, general = null, presaleEnd = null,
      authStart = null, authEnd = null, authNote = null, postUrls = [],
    } = request.body;

    const name = eventName.trim();
    if (!name) return badRequest(reply, '공연/행사명은 필수입니다.');
    if (!presale && !general) return badRequest(reply, '선예매·일반예매 중 하나 이상 입력해주세요.');

    const cleanUrls = postUrls.map((u) => u.trim()).filter(Boolean);
    const postUrlsJson = cleanUrls.length > 0 ? JSON.stringify(cleanUrls) : null;

    const created = await withTransaction(db, async (conn) => {
      const rows = [];
      for (const [stage, info] of [['presale', presale], ['general', general]]) {
        if (!info) continue;
        const title = `${name} ${STAGE_LABEL[stage]}`;
        const [result] = await conn.query(
          'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
          [CATEGORY_IDS.TICKETING, title, info.date, info.time]
        );
        rows.push({ stage, scheduleId: result.insertId, title });

        await conn.query(
          `INSERT INTO schedule_ticketing
             (schedule_id, stage, vendor, ticket_url, purchase_limit, presale_end, auth_start, auth_end, auth_note, post_urls, series_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId, stage, vendor?.trim() || null, ticketUrl?.trim() || null,
            info.purchaseLimit?.trim() || null, presaleEnd || null,
            authStart || null, authEnd || null, authNote?.trim() || null,
            postUrlsJson, seriesId,
          ]
        );
      }

      // 세트 상호 참조
      if (rows.length === 2) {
        await conn.query('UPDATE schedule_ticketing SET pair_schedule_id = ? WHERE schedule_id = ?',
          [rows[1].scheduleId, rows[0].scheduleId]);
        await conn.query('UPDATE schedule_ticketing SET pair_schedule_id = ? WHERE schedule_id = ?',
          [rows[0].scheduleId, rows[1].scheduleId]);
      }
      return rows;
    });

    for (const row of created) {
      await syncScheduleById(meilisearch, db, row.scheduleId, redis);
      logActivity(db, {
        actor: 'admin', action: 'create', category: 'schedule',
        targetType: 'ticketing_schedule', targetId: row.scheduleId,
        summary: `티켓팅 생성: ${row.title}`,
      });
    }

    reply.code(201);
    return { success: true, scheduleIds: created.map((r) => r.scheduleId) };
  });

  /**
   * PUT /api/admin/ticketing/:id — 티켓팅 단건 수정
   */
  fastify.put('/:id', {
    schema: {
      tags: ['admin/ticketing'],
      summary: '티켓팅 일정 수정',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
      body: ticketingUpdateBody,
      response: { 200: { type: 'object', additionalProperties: true }, 404: errorResponse },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      title, date, time, vendor = null, ticketUrl = null, seriesId = null,
      purchaseLimit = null, presaleEnd = null,
      authStart = null, authEnd = null, authNote = null, postUrls = [],
    } = request.body;
    if (!title?.trim()) return badRequest(reply, '제목은 필수입니다.');

    const [existing] = await db.query('SELECT schedule_id FROM schedule_ticketing WHERE schedule_id = ?', [id]);
    if (existing.length === 0) return notFound(reply, '티켓팅 일정을 찾을 수 없습니다.');

    const cleanUrls = postUrls.map((u) => u.trim()).filter(Boolean);

    await withTransaction(db, async (conn) => {
      await conn.query(
        'UPDATE schedules SET title = ?, date = ?, time = ? WHERE id = ?',
        [title.trim(), date, time, id]
      );
      await conn.query(
        `UPDATE schedule_ticketing
         SET vendor = ?, ticket_url = ?, purchase_limit = ?, presale_end = ?, auth_start = ?, auth_end = ?, auth_note = ?, post_urls = ?, series_id = ?
         WHERE schedule_id = ?`,
        [
          vendor?.trim() || null, ticketUrl?.trim() || null, purchaseLimit?.trim() || null,
          presaleEnd || null,
          authStart || null, authEnd || null, authNote?.trim() || null,
          cleanUrls.length > 0 ? JSON.stringify(cleanUrls) : null, seriesId, id,
        ]
      );
    });

    await syncScheduleById(meilisearch, db, parseInt(id), redis);
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'ticketing_schedule', targetId: parseInt(id),
      summary: `티켓팅 수정: ${title.trim()}`,
    });

    return { success: true };
  });
}
