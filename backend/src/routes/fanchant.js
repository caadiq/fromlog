/**
 * 응원법 라우트 (공개 조회 + 관리자 CRUD)
 *
 * 공개는 곡 단위 한 벌을 통째로 내려준다 — 재생 중 매 프레임 계산해야 해서
 * 클라이언트가 전부 들고 있는 편이 낫다.
 */
import { parseJsonColumn } from '../utils/json.js';
import { logActivity } from '../utils/log.js';
import { notFound, badRequest, serverError } from '../utils/error.js';
import { normalizeLines, resolveColors, PART_TYPES } from '../services/fanchant.js';

/** 곡 + 앨범 커버 + 응원법 행을 한 번에 */
async function loadTrack(db, trackId) {
  const [rows] = await db.query(
    `SELECT t.id, t.title, t.lyrics, t.album_id,
            a.title AS album_title, a.cover_medium_url,
            f.video_id, f.color_call, f.color_sing, f.lines_json
       FROM album_tracks t
       JOIN albums a ON a.id = t.album_id
       LEFT JOIN track_fanchant f ON f.track_id = t.id
      WHERE t.id = ?`,
    [trackId]
  );
  return rows[0] || null;
}

export default async function fanchantRoutes(fastify) {
  const { db } = fastify;

  /** GET /fanchant/:trackId — 공개 조회 */
  fastify.get('/:trackId', {
    schema: {
      tags: ['fanchant'],
      summary: '곡 응원법 조회',
      params: { type: 'object', properties: { trackId: { type: 'integer' } } },
    },
  }, async (request, reply) => {
    const row = await loadTrack(db, request.params.trackId);
    if (!row) return notFound(reply, '곡을 찾을 수 없습니다.');
    if (!row.video_id) return notFound(reply, '이 곡은 아직 응원법이 등록되지 않았습니다.');

    const colors = await resolveColors(row, row.cover_medium_url);
    return {
      trackId: row.id,
      trackTitle: row.title,
      albumId: row.album_id,
      albumTitle: row.album_title,
      videoId: row.video_id,
      colors: { call: colors.call, sing: colors.sing },
      lines: parseJsonColumn(row.lines_json, []),
    };
  });

  /** GET /fanchant/:trackId/admin — 편집용 (가사 원문 포함, 인증) */
  fastify.get('/:trackId/admin', {
    schema: { tags: ['fanchant'], summary: '응원법 편집 데이터', security: [{ bearerAuth: [] }] },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const row = await loadTrack(db, request.params.trackId);
    if (!row) return notFound(reply, '곡을 찾을 수 없습니다.');

    const colors = await resolveColors(row, row.cover_medium_url);
    return {
      trackId: row.id,
      trackTitle: row.title,
      albumTitle: row.album_title,
      coverUrl: row.cover_medium_url,
      // 아직 응원법이 없으면 가사를 그대로 초기값으로 준다 (관리자가 여기서 구간을 지정한다)
      lyrics: row.lyrics || '',
      videoId: row.video_id || '',
      colors: { call: colors.call, sing: colors.sing },
      colorSource: colors.source,
      manualColors: { call: row.color_call, sing: row.color_sing },
      lines: parseJsonColumn(row.lines_json, null),
    };
  });

  /** PUT /fanchant/:trackId — 저장 (인증) */
  fastify.put('/:trackId', {
    schema: {
      tags: ['fanchant'],
      summary: '응원법 저장',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['videoId', 'lines'],
        properties: {
          videoId: { type: 'string', minLength: 5, maxLength: 20 },
          colorCall: { type: ['string', 'null'] },
          colorSing: { type: ['string', 'null'] },
          lines: { type: 'array' },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const trackId = request.params.trackId;
    const { videoId, colorCall = null, colorSing = null, lines } = request.body;

    const [[track]] = await db.query('SELECT id, title FROM album_tracks WHERE id = ?', [trackId]);
    if (!track) return notFound(reply, '곡을 찾을 수 없습니다.');

    const hex = /^#[0-9a-f]{6}$/i;
    if ((colorCall && !hex.test(colorCall)) || (colorSing && !hex.test(colorSing))) {
      return badRequest(reply, '색은 #RRGGBB 형식이어야 합니다.');
    }

    const normalized = normalizeLines(lines);
    if (normalized.length === 0) return badRequest(reply, '응원법 내용이 비어 있습니다.');

    try {
      await db.query(
        `INSERT INTO track_fanchant (track_id, video_id, color_call, color_sing, lines_json)
              VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
              video_id = VALUES(video_id), color_call = VALUES(color_call),
              color_sing = VALUES(color_sing), lines_json = VALUES(lines_json)`,
        [trackId, videoId, colorCall, colorSing, JSON.stringify(normalized)]
      );
    } catch (err) {
      fastify.log.error(`응원법 저장 오류: ${err.message}`);
      return serverError(reply, err.message);
    }

    const synced = normalized.filter((l) => !l.gap && l.t != null).length;
    const total = normalized.filter((l) => !l.gap).length;
    logActivity(db, {
      actor: 'admin', action: 'update', category: 'album',
      targetType: 'fanchant', targetId: Number(trackId),
      summary: `응원법 저장: ${track.title} (${synced}/${total}줄 싱크)`,
    });

    return { success: true, lines: normalized.length, synced, total };
  });

  /** DELETE /fanchant/:trackId — 삭제 (인증) */
  fastify.delete('/:trackId', {
    schema: { tags: ['fanchant'], summary: '응원법 삭제', security: [{ bearerAuth: [] }] },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const trackId = request.params.trackId;
    const [[track]] = await db.query('SELECT title FROM album_tracks WHERE id = ?', [trackId]);
    const [res] = await db.query('DELETE FROM track_fanchant WHERE track_id = ?', [trackId]);
    if (res.affectedRows === 0) return notFound(reply, '등록된 응원법이 없습니다.');

    logActivity(db, {
      actor: 'admin', action: 'delete', category: 'album',
      targetType: 'fanchant', targetId: Number(trackId),
      summary: `응원법 삭제: ${track?.title ?? trackId}`,
    });
    return { success: true };
  });

  /** GET /fanchant — 응원법이 있는 곡 목록 (공개, 곡 상세에서 링크 노출 판단용) */
  fastify.get('/', {
    schema: { tags: ['fanchant'], summary: '응원법 보유 곡 목록' },
  }, async () => {
    const [rows] = await db.query(
      `SELECT f.track_id, t.title, a.title AS album_title
         FROM track_fanchant f
         JOIN album_tracks t ON t.id = f.track_id
         JOIN albums a ON a.id = t.album_id
        ORDER BY a.release_date DESC`
    );
    return { items: rows.map((r) => ({ trackId: r.track_id, title: r.title, albumTitle: r.album_title })) };
  });

  fastify.log.debug(`fanchant 라우트 등록 (타입: ${PART_TYPES.join(', ')})`);
}
