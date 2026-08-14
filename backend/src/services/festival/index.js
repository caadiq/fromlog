/**
 * DC 일정 수집 봇 (구 축제 크롤러 대체)
 * DC 갤러리 "앞으로 일정" 최신 글을 긁어 Gemini로 구조화·분류·중복판단한 뒤,
 * 신규 일정을 검토 큐(bot_pending_schedules)에 적재하고 관리자에게 FCM 푸시로 알린다.
 * 자동 등록하지 않는다 — 관리자가 "큐 관리"에서 검토 후 등록한다.
 *
 * 스케줄러 호환을 위해 decorator 이름/시그니처(festivalBot.syncNewFestivals)는 유지한다.
 */
import fp from 'fastify-plugin';
import { fetchLatestSchedulePost } from './scraper.js';
import { extractScheduleItems } from './gemini.js';
import { sendOpsAlert } from '../push.js';

// dedup용 기존 일정 조회 범위 (과거 N일 ~ +M일)
// 과거도 포함해야 "오늘/최근 이미 올라온" 일정을 중복 처리할 수 있음
const LOOKBACK_DAYS = 21;
const LOOKAHEAD_DAYS = 90;

// 유튜브 항목은 "일정까지 만드는 유튜브 봇"이 담당하는 시리즈만 큐에서 뺀다.
// 카테고리 통째로 빼면(구 SKIP_CATEGORIES) 사각지대가 생긴다 — 실제로 '인기가요 끝나면 매점가요',
// 'K판 입덕투어2'는 비정기·1회성이라 봇에 없는데도 큐에 안 담겨 놓쳤다.
const YOUTUBE_CATEGORY = '유튜브';
// 채널명을 시리즈 키로 쪼갤 구분자 ('스프 : 스튜디오 프로미스나인' → 스프 / 스튜디오 프로미스나인)
const CHANNEL_NAME_SPLIT = /[:|\-–—/]/;

// 제목 포함관계로 '확실한 중복'이라 단정할 최소 조건.
// X 일정에는 'ME', 'MEEEEE' 같은 짧은 제목이 있어 길이 제한이 없으면 아무 데나 걸린다.
// 실제 사례("뮤지컬헬스키친" 7자 ⊂ 12자 = 0.58, "워터뮤직풀파티" 7자 ⊂ 17자 = 0.41)를 통과시키는 값.
const MIN_TITLE_CHARS = 7;
const MIN_TITLE_RATIO = 0.4;

/** 제목 정규화 (공백 제거 + 소문자) — 큐 dedup_key용 */
function normalizeTitle(title) {
  return String(title || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * 대조용 정규화 — 공백·구두점·괄호를 모두 걷어내고 소문자로.
 * "뮤지컬 <헬스키친> - 박지원 출연" → "뮤지컬헬스키친박지원출연"
 */
function comparableTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '');
}

/**
 * 기존 일정과의 중복 여부를 코드로 판정한다.
 *
 * AI(is_duplicate)만 믿었더니 표현이 다르면 놓쳤다. 실제로 놓친 사례:
 *   "뮤지컬 헬스키친"            ↔ "뮤지컬 <헬스키친> - 박지원 출연"
 *   "워터 뮤직 풀 파티"          ↔ "2026 캐리비안 베이 워터 뮤직 풀파티"
 *   "ASIA TOUR TOMRROW GLOW. 1일차" ↔ "2026 fromis_9 ASIA TOUR TOMORROW GLOW."
 * 셋 다 날짜가 정확히 같았으므로, 날짜를 축으로 두 단계로 판정한다.
 *
 * @returns {{kind:'exact'|'suspect', match:object} | null}
 *   exact   — 제목이 서로를 포함. 확실한 중복이라 큐에 담지 않는다.
 *   suspect — 같은 날짜·같은 카테고리. 담되 "겹칠 수 있음"으로 표시해 사람이 판단한다.
 */
function findExistingMatch(item, existing) {
  if (!item.date) return null;

  // 같은 날짜 + 같은 카테고리만 후보로 둔다.
  // 카테고리를 안 보면 X 일정(💌 계열 1000여 건)과 엉뚱하게 엮인다.
  const candidates = existing.filter(
    e => e.date === item.date && e.category === item.category
  );
  if (candidates.length === 0) return null;

  const a = comparableTitle(item.title);
  if (a.length >= MIN_TITLE_CHARS) {
    const contained = candidates.find(e => {
      const b = comparableTitle(e.title);
      if (b.length < MIN_TITLE_CHARS) return false; // 'me' 같은 짧은 제목은 아무데나 걸린다
      if (!a.includes(b) && !b.includes(a)) return false;
      // 짧은 쪽이 긴 쪽의 일부만 차지하면 우연일 수 있어 '의심'으로 넘긴다
      return Math.min(a.length, b.length) / Math.max(a.length, b.length) >= MIN_TITLE_RATIO;
    });
    if (contained) return { kind: 'exact', match: contained };
  }

  return { kind: 'suspect', match: candidates[0] };
}

/**
 * 유튜브 봇 한 대가 담당하는 시리즈 키를 뽑는다.
 *
 * 예고 일정을 만드는 봇은 auto_schedule_config에 시리즈명이 들어 있다.
 *   {"titleTemplate":"이단장 시즌2 EP.{episode}","episodeMatch":"이단장 시즌2"} → '이단장 시즌2'
 *   {"titleTemplate":"워크돌"}                                              → '워크돌'
 *   {"titleTemplate":"{channelName}"}                                      → (채널명으로 대체)
 * 설정이 없는 봇(업로드 후 사후 등록형)은 채널명만 키가 된다.
 *
 * title_filters는 키로 쓰지 않는다 — 대부분 ["프로미스나인"]이라 거의 모든 항목에 걸린다.
 */
function seriesKeysOf(bot) {
  const keys = [];

  let cfg = null;
  try {
    cfg = typeof bot.auto_schedule_config === 'string'
      ? JSON.parse(bot.auto_schedule_config)
      : bot.auto_schedule_config;
  } catch {
    cfg = null;
  }

  if (cfg?.episodeMatch) keys.push(cfg.episodeMatch);
  if (cfg?.titleTemplate) {
    // '{episode}' 같은 자리표시자와 그 앞의 'EP.' 꼬리를 걷어낸다
    keys.push(String(cfg.titleTemplate).replace(/\{[^}]*\}/g, '').replace(/\s*(ep\.?|화)\s*$/i, ''));
  }
  // 채널명은 통째로도, 구분자로 쪼갠 조각으로도 쓴다 ('스프 63화'처럼 앞부분만 적기도 한다)
  keys.push(bot.channel_name, ...String(bot.channel_name || '').split(CHANNEL_NAME_SPLIT));

  // 한 글자짜리 키는 아무 데나 걸리므로 버린다
  return [...new Set(keys.map(comparableTitle).filter(k => k.length >= 2))];
}

async function festivalBotPlugin(fastify) {
  const { db } = fastify;

  /** dedup 컨텍스트: 향후 기존 일정 목록 */
  async function fetchExistingSchedules() {
    const [rows] = await db.query(
      `SELECT s.date, s.time, s.title, c.name category,
              COALESCE(sy.channel_name, sv.broadcaster) source
         FROM schedules s
         JOIN schedule_categories c ON c.id = s.category_id
         LEFT JOIN schedule_youtube sy ON sy.schedule_id = s.id
         LEFT JOIN schedule_variety sv ON sv.schedule_id = s.id
        WHERE s.date BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY s.date, s.time`,
      [LOOKBACK_DAYS, LOOKAHEAD_DAYS]
    );
    return rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      time: r.time ? String(r.time).slice(0, 5) : '',
      title: r.title,
      category: r.category,
      channel: r.source || '',
    }));
  }

  /**
   * 일정까지 만드는 유튜브 봇들의 담당 시리즈 키 목록.
   * 아카이브 전용 봇(add_to_schedule=0)은 일정을 안 만드니 담당으로 치지 않는다.
   */
  async function fetchCoveredYoutubeSeries() {
    const [rows] = await db.query(
      `SELECT channel_name, auto_schedule_config
         FROM bot_youtube
        WHERE enabled = 1 AND add_to_schedule = 1`
    );
    return [...new Set(rows.flatMap(seriesKeysOf))];
  }

  /** 이 글을 이미 처리했는지 (festival_crawl_log 재사용) */
  async function isPostProcessed(postUrl) {
    const [rows] = await db.query(
      'SELECT 1 FROM festival_crawl_log WHERE post_url = ? LIMIT 1',
      [postUrl]
    );
    return rows.length > 0;
  }

  async function logPost(postUrl, status, count = 0) {
    await db.query(
      `INSERT IGNORE INTO festival_crawl_log (post_url, status, result_count) VALUES (?, ?, ?)`,
      [postUrl, status, count]
    );
  }

  /**
   * 신규 항목을 큐에 적재.
   * - 날짜 미정 항목도 date=NULL로 담음 (dedup_key = 'nodate|제목')
   * - 다음 크롤에서 같은 제목에 날짜가 생기면 기존 '미정' 행을 날짜 채워 업데이트
   * - dedup_key 유니크로 재적재/무시항목 재등장 방지 (제목에 EP번호가 있어 회차 구분됨)
   */
  async function enqueueItems(items, sourceRef, existing = []) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const it of items) {
      const titleKey = normalizeTitle(it.title);
      const hasDate = !!it.date;
      const members = JSON.stringify(Array.isArray(it.members) ? it.members : []);

      // AI가 놓친 중복을 코드로 한 번 더 거른다
      const dup = findExistingMatch(it, existing);
      if (dup?.kind === 'exact') {
        fastify.log.info(
          `[dcbot] 기존 일정과 중복이라 건너뜀: "${it.title}" ↔ "${dup.match.title}" (${it.date})`
        );
        skipped++;
        continue;
      }
      const dupHint = dup?.kind === 'suspect'
        ? `${dup.match.date} [${dup.match.category}] ${dup.match.title}`.slice(0, 255)
        : null;

      // 날짜가 생긴 경우: 같은 제목의 '미정' 대기 행이 있으면 채워서 업데이트
      if (hasDate) {
        const [u] = await db.query(
          `SELECT id FROM bot_pending_schedules WHERE dedup_key = ? AND status = 'pending' LIMIT 1`,
          [`nodate|${titleKey}`]
        );
        if (u.length) {
          const newKey = `${it.date}|${titleKey}`;
          try {
            await db.query(
              `UPDATE bot_pending_schedules
                 SET date = ?, time = ?, category_name = ?, members = ?, venue_name = ?, description = ?, raw = ?, dedup_key = ?, source_ref = ?
               WHERE id = ?`,
              [it.date, it.time || null, it.category || '기타', members, it.venue_name || null, it.description || null, JSON.stringify(it), newKey, sourceRef, u[0].id]
            );
            updated++;
          } catch (e) {
            // 이미 같은 날짜|제목 행이 있으면(중복) 미정 행 제거
            if (e.code === 'ER_DUP_ENTRY') {
              await db.query('DELETE FROM bot_pending_schedules WHERE id = ?', [u[0].id]);
            } else {
              throw e;
            }
          }
          continue;
        }
      }

      const dedupKey = hasDate ? `${it.date}|${titleKey}` : `nodate|${titleKey}`;
      const [res] = await db.query(
        `INSERT IGNORE INTO bot_pending_schedules
           (source, source_ref, category_name, title, date, time, members, venue_name, description, raw, dup_hint, dedup_key)
         VALUES ('dc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sourceRef,
          it.category || '기타',
          it.title,
          hasDate ? it.date : null,
          it.time || null,
          members,
          it.venue_name || null,
          it.description || null,
          JSON.stringify(it),
          dupHint,
          dedupKey,
        ]
      );
      if (res.affectedRows > 0) added++;
    }
    return { added, updated, skipped };
  }

  /**
   * 신규 일정 수집 (스케줄러가 호출) — 큐 적재 + 푸시. 자동 등록 안 함.
   * @param {object} bot - { id, searchUrl }
   * @returns {{addedCount:number, total:number}}
   */
  async function syncNewFestivals(bot) {
    const apiKey = fastify.config.gemini?.apiKey;
    if (!apiKey) {
      fastify.log.warn('[dcbot] GEMINI_API_KEY 미설정 - 수집 건너뜀');
      return { addedCount: 0, total: 0 };
    }

    // 1) 최신 글 가져오기
    const post = await fetchLatestSchedulePost(bot.searchUrl, fastify.log);
    if (!post) {
      return { addedCount: 0, total: 0 };
    }

    // 2) 이미 처리한 글이면 Gemini 건너뜀
    if (await isPostProcessed(post.postUrl)) {
      fastify.log.info(`[dcbot] 이미 처리한 글 (${post.postNo}) - 건너뜀`);
      return { addedCount: 0, total: 0 };
    }

    fastify.log.info(`[dcbot] 새 글 #${post.postNo} 파싱 (${post.body.length}자)`);

    // 3) 기존 일정 dedup 컨텍스트
    const existing = await fetchExistingSchedules();
    const year = new Date().getFullYear();

    // 4) Gemini 추출·분류·중복판단
    let items;
    try {
      items = await extractScheduleItems(post.body, existing, apiKey, year);
    } catch (err) {
      if (err.code === 'PARSE_FAILED') {
        fastify.log.warn(`[dcbot] Gemini 비-JSON 응답 - 이 글 건너뜀: ${err.message}`);
        await logPost(post.postUrl, 'error', 0);
        return { addedCount: 0, total: 0 };
      }
      fastify.log.error(`[dcbot] Gemini 분석 실패: ${err.message}`);
      throw err;
    }

    // 5) 신규(중복 아님)만 큐에 적재 (날짜 미정 포함)
    //    유튜브는 담당 봇이 있는 시리즈만 뺀다 — 비정기·1회성 출연은 봇이 예측 못 하므로 사람이 봐야 한다
    const coveredSeries = await fetchCoveredYoutubeSeries();
    const coveredByBot = (it) => {
      if (it.category !== YOUTUBE_CATEGORY) return false;
      const t = comparableTitle(it.title);
      return coveredSeries.some(k => t.includes(k));
    };
    const fresh = items.filter(it => it && it.title && !it.is_duplicate && !coveredByBot(it));
    const { added, updated, skipped } = await enqueueItems(fresh, String(post.postNo), existing);

    // 6) 글 처리 완료 기록
    await logPost(post.postUrl, (added + updated) > 0 ? 'processed' : 'no_event', added);

    fastify.log.info(
      `[dcbot] 추출 ${items.length} / 신규 ${fresh.length} / 큐 적재 ${added} / 날짜채움 ${updated} / 기존중복 제외 ${skipped}`
    );

    // 7) 새로 적재된 게 있으면 관리자에게 푸시
    if (added > 0) {
      try {
        await sendOpsAlert(db, {
          title: '새 일정 수집 대기',
          body: `수집 대기 ${added}건이 큐에 등록됐어요. 관리자 페이지에서 검토·등록하세요.`,
          data: { type: 'schedule_queue' },
        });
      } catch (err) {
        fastify.log.warn(`[dcbot] 푸시 발송 실패: ${err.message}`);
      }
    }

    return { addedCount: added, total: items.length };
  }

  fastify.decorate('festivalBot', {
    syncNewFestivals,
  });
}

export default fp(festivalBotPlugin, {
  name: 'festivalBot',
  dependencies: ['db'],
});
