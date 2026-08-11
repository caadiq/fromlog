import { parseJsonColumn } from '../../utils/json.js';
import { logActivity } from '../../utils/log.js';
import { createEtcSchedule, createEventSchedule, geocodeVenue } from '../../services/event.js';
import { uploadEtcPoster, uploadEventPoster } from '../../services/image.js';

// 큐에서 서버 등록을 지원하는 카테고리 (그 외는 관리자 폼에서 직접 추가)
const REGISTERABLE = ['기타', '행사'];

/** multipart에서 payload(JSON) + poster 파일들 추출 */
async function parseMultipartForm(request) {
  const parts = request.parts();
  let payload = null;
  const posterFiles = [];
  for await (const part of parts) {
    if (part.type === 'file') {
      posterFiles.push({ filename: part.filename, buffer: await part.toBuffer() });
    } else if (part.fieldname === 'payload') {
      payload = JSON.parse(part.value);
    }
  }
  return { payload, posterFiles };
}

/** images 테이블 INSERT 후 id 반환 */
async function saveImageRecord(db, { originalUrl, mediumUrl, thumbUrl }) {
  const [result] = await db.query(
    `INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)`,
    [originalUrl, mediumUrl, thumbUrl]
  );
  return result.insertId;
}

function rowToItem(r) {
  return {
    id: r.id,
    source: r.source,
    sourceRef: r.source_ref,
    category: r.category_name,
    title: r.title,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : (r.date ? String(r.date).slice(0, 10) : ''),
    time: r.time ? String(r.time).slice(0, 5) : '',
    members: r.members ? parseJsonColumn(r.members) : [],
    venueName: r.venue_name || '',
    description: r.description || '',
    // 같은 날·같은 카테고리에 비슷한 일정이 이미 있을 때 그 요약 (없으면 '')
    dupHint: r.dup_hint || '',
    status: r.status,
    createdScheduleId: r.created_schedule_id,
    createdAt: r.created_at,
  };
}

/**
 * 관리자 - 수집 큐(검토 대기) 라우트
 * DC봇이 적재한 신규 일정 후보를 검토·등록·무시한다.
 */
export default async function pendingRoutes(fastify) {
  const { db, meilisearch } = fastify;

  /** GET /admin/pending — 대기 목록 (기본 pending만) */
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const status = request.query.status || 'pending';
    const [rows] = await db.query(
      `SELECT * FROM bot_pending_schedules WHERE status = ? ORDER BY date IS NULL, date, time`,
      [status]
    );
    return { items: rows.map(rowToItem) };
  });

  /** GET /admin/pending/count — 대기 건수 (배지용) */
  fastify.get('/count', { preHandler: [fastify.authenticate] }, async () => {
    const [[{ n }]] = await db.query(
      `SELECT COUNT(*) n FROM bot_pending_schedules WHERE status = 'pending'`
    );
    return { count: n };
  });

  /**
   * POST /admin/pending/:id/register — 검토 후 등록 (multipart: payload + poster 파일들)
   * payload: { category, title, date, time?, description?, venue?, venueName?, postUrls? }
   * - venue: 장소 검색으로 고른 객체(좌표 포함). 없고 venueName만 있으면 서버가 지오코딩
   */
  fastify.post('/:id/register', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;

    const [rows] = await db.query('SELECT * FROM bot_pending_schedules WHERE id = ?', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: '큐 항목을 찾을 수 없습니다.' });
    if (rows[0].status !== 'pending') return reply.code(409).send({ error: '이미 처리된 항목입니다.' });

    const { payload, posterFiles } = await parseMultipartForm(request);
    const b = payload || {};
    const category = b.category || rows[0].category_name;
    const title = (b.title ?? rows[0].title)?.trim();
    const date = b.date ?? (rows[0].date instanceof Date ? rows[0].date.toISOString().slice(0, 10) : rows[0].date);
    const time = b.time || (rows[0].time ? String(rows[0].time).slice(0, 5) : null);
    const description = b.description ?? rows[0].description ?? '';
    const postUrls = Array.isArray(b.postUrls) ? b.postUrls : [];

    if (!title || !date) {
      return reply.code(400).send({ error: '제목/날짜는 필수입니다.' });
    }
    if (!REGISTERABLE.includes(category)) {
      return reply.code(400).send({
        error: `'${category}' 카테고리는 큐에서 바로 등록할 수 없어요. 관리자 폼에서 직접 추가한 뒤 이 항목은 무시하세요.`,
        code: 'UNSUPPORTED_CATEGORY',
      });
    }

    // 장소: 검색으로 고른 객체 우선, 없으면 이름만으로 지오코딩
    const venue = b.venue || (b.venueName ? await geocodeVenue(b.venueName) : null);

    let scheduleId;
    if (category === '기타') {
      scheduleId = await createEtcSchedule(db, meilisearch, { title, date, time, description, venue, postUrls });
    } else {
      // 행사 (일반)
      scheduleId = await createEventSchedule(db, meilisearch, {
        title, date, time, subtype: 'general', schoolName: null, venue, postUrls,
      });
    }

    // 포스터 업로드 (트랜잭션/생성 후 — S3 I/O)
    if (posterFiles.length > 0) {
      const isEtc = category === '기타';
      const uploadFn = isEtc ? uploadEtcPoster : uploadEventPoster;
      const table = isEtc ? 'schedule_etc' : 'schedule_event';
      const uploadedIds = [];
      for (let i = 0; i < posterFiles.length; i++) {
        const ext = (posterFiles[i].filename.split('.').pop() || 'webp').toLowerCase();
        const filename = `${String(i + 1).padStart(2, '0')}.${ext === 'jpg' ? 'jpeg' : ext}`;
        const urls = await uploadFn(scheduleId, filename, posterFiles[i].buffer);
        uploadedIds.push(await saveImageRecord(db, urls));
      }
      await db.query(
        `UPDATE ${table} SET poster_image_ids = ? WHERE schedule_id = ?`,
        [JSON.stringify(uploadedIds), scheduleId]
      );
    }

    await db.query(
      `UPDATE bot_pending_schedules SET status = 'registered', created_schedule_id = ?, resolved_at = NOW() WHERE id = ?`,
      [scheduleId, id]
    );

    logActivity(db, {
      actor: 'admin', action: 'create', category: 'schedule',
      targetType: 'queue_register', targetId: scheduleId,
      summary: `큐에서 등록(${category}): ${title}`,
    });

    reply.code(201);
    return { id: scheduleId };
  });

  /** POST /admin/pending/:id/dismiss — 무시 */
  fastify.post('/:id/dismiss', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await db.query('SELECT status, title FROM bot_pending_schedules WHERE id = ?', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: '큐 항목을 찾을 수 없습니다.' });

    await db.query(
      `UPDATE bot_pending_schedules SET status = 'dismissed', resolved_at = NOW() WHERE id = ?`,
      [id]
    );

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'schedule',
      targetType: 'queue_dismiss', targetId: parseInt(id),
      summary: `큐 무시: ${rows[0].title}`,
    });

    return { success: true };
  });
}
