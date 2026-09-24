/**
 * 관리자 - 일정 고정 링크 CRUD
 * /api/admin/schedule-links
 *
 * 순서는 관리자가 드래그로 정한 sort_order를 그대로 쓴다(마감 임박순 자동정렬 안 함).
 */
import { badRequest, notFound } from '../../utils/error.js';
import { withTransaction } from '../../utils/transaction.js';
import { logActivity } from '../../utils/log.js';

function rowToItem(r) {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    // DATE_FORMAT으로 뽑은 'YYYY-MM-DDTHH:mm' 문자열을 그대로 쓴다(타임존 표기 없음).
    startsAt: r.starts_at || null,
    endsAt: r.ends_at || null,
    sortOrder: r.sort_order,
    enabled: Boolean(r.is_enabled),
  };
}

/**
 * 'YYYY-MM-DDTHH:mm' → MySQL DATETIME 문자열.
 *
 * Date 객체를 거치지 않는다 — 거치면 서버 타임존에 따라 시각이 밀린다.
 * 관리자가 입력한 벽시계 시각을 그대로 저장하고, 비교도 같은 기준(NOW())으로 한다.
 */
function toDateTime(v) {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(v).trim());
  return m ? `${m[1]} ${m[2]}:00` : null;
}

/** 입력 검증 — 통과하면 null, 아니면 에러 메시지 */
function validate({ title, url, startsAt, endsAt, enabled }) {
  if (enabled !== undefined && typeof enabled !== 'boolean') return '공개 여부를 확인해주세요.';
  if (!title?.trim()) return '제목을 입력해주세요.';
  if (title.trim().length > 120) return '제목은 120자를 넘을 수 없습니다.';
  if (!url?.trim()) return 'URL을 입력해주세요.';
  if (!/^https?:\/\//i.test(url.trim())) return 'URL은 http:// 또는 https:// 로 시작해야 합니다.';
  if (url.trim().length > 500) return 'URL이 너무 깁니다.';
  const s = toDateTime(startsAt);
  const e = toDateTime(endsAt);
  if (s && e && s > e) return '종료일이 시작일보다 빠릅니다.';
  return null;
}

export default async function adminScheduleLinkRoutes(fastify) {
  const { db } = fastify;

  /** GET / — 전체 목록 (만료·예정 포함, 관리자는 다 봐야 함) */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async () => {
    const [rows] = await db.query(
      `SELECT id, title, url, sort_order, is_enabled,
              DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i') AS starts_at,
              DATE_FORMAT(ends_at,   '%Y-%m-%dT%H:%i') AS ends_at
         FROM schedule_links ORDER BY sort_order, id`
    );
    return rows.map(rowToItem);
  });

  /** POST / — 추가 (맨 뒤에 붙임) */
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body || {};
    const err = validate(body);
    if (err) return badRequest(reply, err);

    const [[{ next: nextOrder }]] = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM schedule_links'
    );
    const [res] = await db.query(
      `INSERT INTO schedule_links (title, url, starts_at, ends_at, sort_order, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.title.trim(),
        body.url.trim(),
        toDateTime(body.startsAt),
        toDateTime(body.endsAt),
        nextOrder,
        body.enabled === false ? 0 : 1,
      ]
    );
    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'schedule_link', targetId: res.insertId,
      summary: `고정 링크 추가: ${body.title.trim()}`,
    });
    return reply.code(201).send({ id: res.insertId });
  });

  /** PUT /:id — 수정 */
  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    const err = validate(body);
    if (err) return badRequest(reply, err);

    const [rows] = await db.query('SELECT id FROM schedule_links WHERE id = ?', [id]);
    if (rows.length === 0) return notFound(reply, '링크를 찾을 수 없습니다.');

    await db.query(
      `UPDATE schedule_links
          SET title = ?, url = ?, starts_at = ?, ends_at = ?, is_enabled = COALESCE(?, is_enabled)
        WHERE id = ?`,
      [
        body.title.trim(),
        body.url.trim(),
        toDateTime(body.startsAt),
        toDateTime(body.endsAt),
        body.enabled === undefined ? null : Number(body.enabled),
        id,
      ]
    );
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'schedule',
      targetType: 'schedule_link', targetId: parseInt(id),
      summary: `고정 링크 수정: ${body.title.trim()}`,
    });
    return { ok: true };
  });

  /** PATCH /:id/visibility — toggle without overwriting title, period, or order. */
  fastify.patch('/:id/visibility', {
    preHandler: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['enabled'], properties: { enabled: { type: 'boolean' } } } },
  }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await db.query('SELECT title FROM schedule_links WHERE id = ?', [id]);
    if (!rows.length) return notFound(reply, '링크를 찾을 수 없습니다.');
    await db.query('UPDATE schedule_links SET is_enabled = ? WHERE id = ?', [Number(request.body.enabled), id]);
    logActivity(db, { actor: 'admin', action: 'update', category: 'schedule', targetType: 'schedule_link', targetId: Number(id), summary: `고정 링크 ${request.body.enabled ? '공개' : '숨김'}: ${rows[0].title}`, details: { enabled: request.body.enabled } });
    return { ok: true };
  });

  /** DELETE /:id */
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await db.query('SELECT title FROM schedule_links WHERE id = ?', [id]);
    if (rows.length === 0) return notFound(reply, '링크를 찾을 수 없습니다.');

    await db.query('DELETE FROM schedule_links WHERE id = ?', [id]);
    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'schedule',
      targetType: 'schedule_link', targetId: parseInt(id),
      summary: `고정 링크 삭제: ${rows[0].title}`,
    });
    return { ok: true };
  });

  /** PUT /order — 드래그로 바뀐 순서 일괄 저장 */
  fastify.put('/order', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const ids = request.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest(reply, '순서 목록이 비어 있습니다.');
    }
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) return badRequest(reply, '순서 목록을 확인해주세요.');
    const saved = await withTransaction(db, async conn => {
      const [rows] = await conn.query('SELECT id FROM schedule_links ORDER BY id FOR UPDATE');
      if (rows.length !== ids.length || rows.some(row => !ids.includes(row.id))) return false;
      for (let i = 0; i < ids.length; i++) await conn.query('UPDATE schedule_links SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
      return true;
    });
    if (!saved) return badRequest(reply, '목록이 변경되었습니다. 새로 불러온 후 다시 시도해주세요.');
    logActivity(db, { actor: 'admin', action: 'update', category: 'schedule', targetType: 'schedule_link', summary: '고정 링크 순서 변경', details: { ids } });
    return { ok: true };
  });
}
