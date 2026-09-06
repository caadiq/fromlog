import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../utils/transaction.js';
import { syncScheduleById } from '../../services/meilisearch/index.js';
import { CATEGORY_IDS } from '../../config/index.js';
import { parseJsonColumn } from '../../utils/json.js';
import { logActivity } from '../../utils/log.js';
import { insertEtcSchedule, insertEventSchedule, insertVarietySchedule, geocodeVenue } from '../../services/event.js';
import { uploadEtcPoster, uploadEventPoster } from '../../services/image.js';
import { insertTempYoutubeSchedule } from '../../utils/tempSchedule.js';

// 큐에서 서버 등록을 지원하는 카테고리 (그 외는 관리자 폼에서 직접 추가)
// 유튜브는 영상이 아직 없으므로 '예정 일정'(is_temp=1, video_id 없음)으로 만든다.
// 나중에 영상이 올라오면 봇이 제목으로 찾아 실제 영상으로 승격한다 → utils/tempSchedule.js
const REGISTERABLE = ['기타', '행사', '유튜브', '예능'];

function requestError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

async function lockQueue(conn, id) {
  const [[row]] = await conn.query('SELECT * FROM bot_pending_schedules WHERE id = ? FOR UPDATE', [id]);
  if (!row) throw requestError(404, '큐 항목을 찾을 수 없습니다.');
  if (row.status === 'dismissed') throw requestError(409, '이미 무시된 항목입니다.');
  return row;
}

async function lockLinkedSchedule(conn, row) {
  const [[schedule]] = await conn.query('SELECT id, category_id FROM schedules WHERE id = ? FOR UPDATE', [row.created_schedule_id]);
  if (!schedule) throw requestError(409, '연결된 일정이 삭제되었습니다. 일정 관리에서 확인해주세요.');
  return schedule;
}

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
    // 최신 DC 글에 더 이상 없는 항목 — 날짜가 바뀌었거나 취소됐을 수 있다
    stale: !!r.stale_at,
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
  const { db, meilisearch, redis } = fastify;

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
   * payload: { category, title, date, time?, description?, venue?, venueName?, postUrls?, broadcaster?, replayUrl? }
   * - venue: 장소 검색으로 고른 객체(좌표 포함). 없고 venueName만 있으면 서버가 지오코딩
   */
  fastify.post('/:id/register', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;

    const [rows] = await db.query('SELECT * FROM bot_pending_schedules WHERE id = ?', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: '큐 항목을 찾을 수 없습니다.' });
    if (rows[0].status === 'dismissed') return reply.code(409).send({ error: '이미 무시된 항목입니다.' });

    const { payload, posterFiles } = await parseMultipartForm(request);
    const b = payload || {};
    const category = b.category || rows[0].category_name;
    const title = (b.title ?? rows[0].title)?.trim();
    const date = b.date ?? (rows[0].date instanceof Date ? rows[0].date.toISOString().slice(0, 10) : rows[0].date);
    const time = b.time || (rows[0].time ? String(rows[0].time).slice(0, 5) : null);
    const description = b.description ?? rows[0].description ?? '';
    const postUrls = Array.isArray(b.postUrls) ? b.postUrls : [];

    if (!rows[0].created_schedule_id && (!title || !date)) {
      return reply.code(400).send({ error: '제목/날짜는 필수입니다.' });
    }
    if (!rows[0].created_schedule_id && !REGISTERABLE.includes(category)) {
      return reply.code(400).send({
        error: `'${category}' 카테고리는 큐에서 바로 등록할 수 없어요. 관리자 폼에서 직접 추가한 뒤 이 항목은 무시하세요.`,
        code: 'UNSUPPORTED_CATEGORY',
      });
    }

    // 장소: 검색으로 고른 객체 우선, 없으면 이름만으로 지오코딩
    const venue = rows[0].created_schedule_id ? null : (b.venue || (b.venueName ? await geocodeVenue(b.venueName) : null));

    // 예능은 방송사가 필수 (schedule_variety.broadcaster NOT NULL)
    if (!rows[0].created_schedule_id && category === '예능' && !b.broadcaster?.trim()) {
      return reply.code(400).send({ error: '예능은 방송사/플랫폼이 필요합니다.' });
    }

    // Persist the schedule and its queue link together before any poster I/O.
    const registration = await withTransaction(db, async conn => {
      const row = await lockQueue(conn, id);
      if (row.created_schedule_id) {
        const schedule = await lockLinkedSchedule(conn, row);
        return { scheduleId: schedule.id, created: false };
      }
      if (row.status !== 'pending') throw requestError(409, '이미 처리된 항목입니다.');
      let scheduleId;
      if (category === '유튜브') {
        scheduleId = await insertTempYoutubeSchedule(conn, { title, date, time });
      } else if (category === '예능') {
        scheduleId = await insertVarietySchedule(conn, {
          title, date, time, broadcaster: b.broadcaster, description, replayUrl: b.replayUrl || null,
        });
      } else if (category === '기타') {
        scheduleId = await insertEtcSchedule(conn, { title, date, time, description, venue, postUrls });
      } else {
        scheduleId = await insertEventSchedule(conn, {
          title, date, time, subtype: 'general', schoolName: null, venue, postUrls,
        });
      }
      await conn.query(
        'UPDATE bot_pending_schedules SET created_schedule_id = ? WHERE id = ?', [scheduleId, id]
      );
      return { scheduleId, created: true };
    });
    const { scheduleId } = registration;

    try {
      // Serialize retries, poster attachment and completion on this queue row.
      // A crash rolls back only this phase; the durable schedule link remains.
      const completed = await withTransaction(db, async conn => {
        const row = await lockQueue(conn, id);
        const schedule = await lockLinkedSchedule(conn, row);
        if (row.status === 'registered') return false;
        if (schedule.id !== scheduleId) throw requestError(409, '큐에 연결된 일정이 변경되었습니다.');
        const table = schedule.category_id === CATEGORY_IDS.ETC ? 'schedule_etc'
          : schedule.category_id === CATEGORY_IDS.EVENT ? 'schedule_event' : null;
        if (posterFiles.length && table) {
          const [[details]] = await conn.query('SELECT poster_image_ids FROM ?? WHERE schedule_id = ? FOR UPDATE', [table, scheduleId]);
          if (!details) throw requestError(409, '일정 상세 정보를 찾을 수 없습니다.');
          const imageIds = parseJsonColumn(details.poster_image_ids) || [];
          const uploadFn = table === 'schedule_etc' ? uploadEtcPoster : uploadEventPoster;
          for (let i = 0; i < posterFiles.length; i++) {
            // Failed attempts must never overwrite images attached by another attempt.
            const urls = await uploadFn(scheduleId, `${randomUUID()}.webp`, posterFiles[i].buffer);
            imageIds.push(await saveImageRecord(conn, urls));
          }
          await conn.query('UPDATE ?? SET poster_image_ids = ? WHERE schedule_id = ?', [table, JSON.stringify(imageIds), scheduleId]);
        }
        await conn.query(
          "UPDATE bot_pending_schedules SET status = 'registered', resolved_at = NOW() WHERE id = ?", [id]
        );
        return true;
      });
      if (completed) {
        logActivity(db, {
          actor: 'admin', action: 'create', category: 'schedule',
          targetType: 'queue_register', targetId: scheduleId,
          summary: `큐에서 등록 완료: ${title}`,
        });
      }
    } catch (error) {
      logActivity(db, {
        actor: 'admin', action: 'error', category: 'schedule',
        targetType: 'queue_register', targetId: scheduleId,
        summary: '큐 등록 미완료: 기존 일정에 다시 시도 가능',
      });
      await syncScheduleById(meilisearch, db, scheduleId, redis);
      return reply.code(error.statusCode || 500).send({
        error: error.statusCode ? error.message : '일정은 저장됐지만 등록을 마치지 못했습니다. 다시 등록하면 기존 일정에 포스터만 다시 처리합니다. 제목·날짜 등은 일정 관리에서 수정해주세요.',
        createdScheduleId: scheduleId,
      });
    }
    await syncScheduleById(meilisearch, db, scheduleId, redis);
    reply.code(registration.created ? 201 : 200);
    return { id: scheduleId };
  });

  /** POST /admin/pending/:id/dismiss — 무시 */
  fastify.post('/:id/dismiss', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const row = await withTransaction(db, async conn => {
      const [[current]] = await conn.query('SELECT * FROM bot_pending_schedules WHERE id = ? FOR UPDATE', [id]);
      if (!current) throw requestError(404, '큐 항목을 찾을 수 없습니다.');
      if (current.status === 'registered' || current.created_schedule_id) {
        throw requestError(409, '이미 일정이 생성된 항목입니다. 등록을 완료하거나 일정 관리에서 확인해주세요.');
      }
      await conn.query(
        "UPDATE bot_pending_schedules SET status = 'dismissed', resolved_at = NOW() WHERE id = ?", [id]
      );
      return current;
    });

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'schedule',
      targetType: 'queue_dismiss', targetId: parseInt(id),
      summary: `큐 무시: ${row.title}`,
    });

    return { success: true };
  });
}
