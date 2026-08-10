/**
 * 영상 아카이브 공개 API
 * - GET /videos/home    : 영상 메인 페이지 (피처드 + 카테고리 섹션 + 쇼츠 레일)
 * - GET /videos         : 전체보기 목록 (카테고리·멤버·쇼츠 필터 + 월 그룹 페이징)
 */
import { errorResponse } from '../schemas/index.js';
import { parseJsonColumn } from '../utils/json.js';

const CATEGORIES = ['official', 'sp', 'variety', 'music'];

/**
 * 카테고리별 표시 라벨 — 해당 카테고리 봇이 단일 채널이면 채널명, 복수면 null(프론트 기본 라벨)
 */
async function categoryLabels(db) {
  const [rows] = await db.query('SELECT video_category cat, channel_name FROM bot_youtube');
  const map = {};
  for (const r of rows) {
    if (map[r.cat] === undefined) map[r.cat] = r.channel_name;
    else if (map[r.cat] !== r.channel_name) map[r.cat] = null;
  }
  return map;
}

/** row → 응답 형식 */
function formatVideo(row) {
  return {
    videoId: row.video_id,
    title: row.title,
    channelName: row.channel_name,
    category: row.category,
    videoType: row.video_type,
    duration: row.duration ?? null,
    publishedAt: row.published_at
      ? new Date(row.published_at).toISOString().slice(0, 16).replace('T', ' ')
      : null,
    members: parseJsonColumn(row.members, null),
  };
}

export default async function videosRoutes(fastify) {
  const { db } = fastify;

  /**
   * GET /api/videos/home — 영상 메인 페이지 데이터
   */
  fastify.get('/home', {
    schema: {
      tags: ['videos'],
      summary: '영상 메인 (피처드 + 카테고리별 최신 + 쇼츠)',
      response: { 200: { type: 'object', additionalProperties: true }, 500: errorResponse },
    },
  }, async () => {
    // 피처드 — 가장 최근 일반 영상
    // 피처드는 본채널·스프·예능만 — 무대·퍼포먼스는 같은 무대의 직캠이 여러 편 올라와
    // 메인이 계속 직캠으로 채워진다
    const [featRows] = await db.query(
      `SELECT * FROM videos
       WHERE video_type = 'video' AND category IN ('official', 'sp', 'variety')
       ORDER BY published_at DESC LIMIT 1`
    );
    const featured = featRows.length > 0 ? formatVideo(featRows[0]) : null;

    // 카테고리별 최신 4개 (일반 영상)
    // 피처드로 올라간 영상도 그대로 포함한다 — 빼면 해당 채널 섹션에서 최신 영상이
    // 통째로 사라져 목록이 한 칸씩 밀린 것처럼 보인다
    const sections = {};
    for (const cat of CATEGORIES) {
      const [rows] = await db.query(
        `SELECT * FROM videos
         WHERE category = ? AND video_type = 'video'
         ORDER BY published_at DESC LIMIT 4`,
        [cat]
      );
      sections[cat] = rows.map(formatVideo);
    }

    // 쇼츠 레일 — 최신 6개
    const [shortsRows] = await db.query(
      "SELECT * FROM videos WHERE video_type = 'shorts' ORDER BY published_at DESC LIMIT 6"
    );

    // 카테고리별 개수 — 쇼츠는 별도 섹션이라 카테고리 집계에서 제외
    const [counts] = await db.query(
      "SELECT category, COUNT(*) n FROM videos WHERE video_type = 'video' GROUP BY category"
    );
    const countMap = Object.fromEntries(counts.map((c) => [c.category, c.n]));
    const [[{ shortsCount }]] = await db.query(
      "SELECT COUNT(*) shortsCount FROM videos WHERE video_type = 'shorts'"
    );

    return {
      featured,
      sections,
      shorts: shortsRows.map(formatVideo),
      counts: {
        total: counts.reduce((a, c) => a + c.n, 0) + shortsCount,
        ...countMap,
        shorts: shortsCount,
      },
      labels: await categoryLabels(db),
    };
  });

  /**
   * GET /api/videos — 전체보기 목록
   * query: category(official|sp|variety|fancam), member(직캠 멤버명 | 'group'),
   *        channel(예능 채널명), shorts(exclude|only), offset, limit
   */
  fastify.get('/', {
    schema: {
      tags: ['videos'],
      summary: '영상 목록 (필터·페이징)',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          member: { type: 'string', maxLength: 20 },
          channel: { type: 'string', maxLength: 200 },
          shorts: { type: 'string', enum: ['exclude', 'only'] },
          offset: { type: 'integer', minimum: 0, default: 0 },
          limit: { type: 'integer', minimum: 1, maximum: 60, default: 24 },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true }, 500: errorResponse },
    },
  }, async (request) => {
    const { category, member, channel, shorts, offset = 0, limit = 24 } = request.query;

    const where = [];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (channel) { where.push('channel_name = ?'); params.push(channel); }
    if (shorts === 'exclude') where.push("video_type = 'video'");
    if (shorts === 'only') where.push("video_type = 'shorts'");
    if (member === 'group') {
      where.push("(members IS NULL OR members = '[]')");
    } else if (member) {
      where.push('JSON_CONTAINS(members, JSON_QUOTE(?))');
      params.push(member);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) total FROM videos ${whereSql}`, params
    );
    const [rows] = await db.query(
      `SELECT * FROM videos ${whereSql} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 월별 개수 (월 구분선 라벨용 — 현재 필터 기준)
    const [monthRows] = await db.query(
      `SELECT DATE_FORMAT(published_at, '%Y-%m') ym, COUNT(*) n
       FROM videos ${whereSql} GROUP BY ym ORDER BY ym DESC`,
      params
    );

    // 필터 옵션용 집계 (카테고리 지정 시)
    let facets = null;
    if (category === 'music' || category === 'variety') {
      // 음방·기타는 채널이 여럿이라 채널 드롭다운으로 거른다
      const [crows] = await db.query(
        'SELECT channel_name, COUNT(*) n FROM videos WHERE category = ? AND video_type = ? GROUP BY channel_name ORDER BY n DESC',
        [category, 'video']
      );
      facets = { channels: crows.map((r) => ({ name: r.channel_name, count: r.n })) };
    } else if (shorts === 'only') {
      // 쇼츠 전용 페이지의 채널 필터
      const [crows] = await db.query(
        "SELECT channel_name, COUNT(*) n FROM videos WHERE video_type = 'shorts' GROUP BY channel_name ORDER BY n DESC"
      );
      facets = { channels: crows.map((r) => ({ name: r.channel_name, count: r.n })) };
    }

    return {
      videos: rows.map(formatVideo),
      total,
      offset,
      limit,
      hasMore: offset + rows.length < total,
      months: monthRows.map((m) => ({ ym: m.ym, count: m.n })),
      facets,
      categoryLabel: category ? (await categoryLabels(db))[category] || null : null,
    };
  });
}
