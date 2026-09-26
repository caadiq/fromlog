import { withIngestionLock } from '../../utils/youtubeLock.js';
import { withTransaction } from '../../utils/transaction.js';
import { logActivity } from '../../utils/log.js';
import { parseJsonColumn } from '../../utils/json.js';
import { todayKST } from '../../utils/date.js';
import { queueKey, hash, validateScheduleItems } from './items.js';
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
import { comparableTitle, findExistingMatch } from './dedupe.js';

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

/**
 * 생일 '당일'이 아니라 그날 따로 열리는 행사를 가리키는 말.
 * 생일카페·지하철 광고·서포트 같은 건 별개 일정이라 큐에 남겨야 한다.
 */
const BIRTHDAY_EVENT = /생카|카페|광고|서포트|전시|팝업|나눔|컵홀더|파티|이벤트|지하철|버스|옥외|스크린/;

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

/**
 * 최신 글에 더 이상 없는 대기 항목에 '원문에서 사라짐' 표시를 단다.
 *
 * DC 일정글은 누적본이라 지난 일정만 지워지고 나머지는 그대로 다음 글로 옮겨진다.
 * 그래서 "아직 오지 않은 일정인데 최신 글에 없다"면 날짜가 바뀌었거나 취소된 것이다.
 * 실제로 "8/21 or 28 아는 형님"이 다음 날 "8/22"로 확정됐는데, 코드에는
 * 미정→확정 승격만 있어 옛 8/21·8/28 행이 큐에 그대로 남았다.
 *
 * 지우지 않고 표시만 한다 — 원문이 잠깐 흔들리거나 파싱이 부실한 날 큐가 통째로 날아가면 안 된다.
 * 지난 날짜는 원문에서 자연히 사라지므로 대상에서 뺀다(표시해봐야 노이즈다).
 * 다시 원문에 나타나면 표시를 도로 지운다.
 *
 * @param {object} db
 * @param {Array} items - 최신 글에서 추출한 항목 전체 (큐에 담기지 않은 것도 "원문에 있다"는 사실은 같다)
 * @returns {{marked:number, cleared:number}}
 */
export async function markStaleItems(db, items, log = null) {
  // 추출이 통째로 빈 날은 판단 근거가 없다
  if (!items.length) return { marked: 0, cleared: 0 };

  const keys = new Set(
    items
      .filter(it => it?.title)
      .map(queueKey)
  );

  const [rows] = await db.query(
    `SELECT id, dedup_key, stale_at FROM bot_pending_schedules
      WHERE status = 'pending' AND source = 'dc'
        AND (date IS NULL OR date >= CURDATE())`
  );

  const gone = rows.filter(r => !keys.has(r.dedup_key) && !r.stale_at).map(r => r.id);
  const back = rows.filter(r => keys.has(r.dedup_key) && r.stale_at).map(r => r.id);

  if (gone.length) {
    await db.query('UPDATE bot_pending_schedules SET stale_at = NOW() WHERE id IN (?)', [gone]);
    log?.info?.(`[dcbot] 원문에서 사라진 대기 항목 ${gone.length}건 표시`);
  }
  if (back.length) {
    await db.query('UPDATE bot_pending_schedules SET stale_at = NULL WHERE id IN (?)', [back]);
  }
  return { marked: gone.length, cleared: back.length };
}

async function festivalBotPlugin(fastify, options = {}) {
  const { db } = fastify;
  const notify = options.sendOpsAlert || sendOpsAlert;

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

  /** 현 멤버 생일 (이름 + MM-DD) — 생일 항목을 큐에서 빼는 데 쓴다 */
  async function fetchMemberBirthdays() {
    const [rows] = await db.query(
      `SELECT name, DATE_FORMAT(birth_date, '%m-%d') AS md
         FROM members WHERE is_former = 0 AND birth_date IS NOT NULL`
    );
    return rows.map(r => ({ key: comparableTitle(r.name).slice(-2), md: r.md }));
  }

  /** 이 글을 이미 처리했는지 (festival_crawl_log 재사용) */
  async function isPostProcessed(postUrl) {
    const [rows] = await db.query(
      `SELECT 1 FROM festival_crawl_log WHERE post_url = ? AND status IN ('processed', 'no_event')
       AND NOT EXISTS (SELECT 1 FROM bot_collection_runs WHERE post_url = ?) LIMIT 1`,
      [postUrl, postUrl]
    );
    return rows.length > 0;
  }

  async function logPost(conn, postUrl, status, count = 0) {
    await conn.query(
      `INSERT INTO festival_crawl_log (post_url, status, result_count) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), result_count = VALUES(result_count)`,
      [postUrl, status, count]
    );
  }

  /**
   * 신규 항목을 큐에 적재.
   * - 날짜 미정 항목도 date=NULL로 담음 (dedup_key = 'nodate|제목')
   * - 다음 크롤에서 같은 제목에 날짜가 생기면 기존 '미정' 행을 날짜 채워 업데이트
   * - dedup_key 유니크로 재적재/무시항목 재등장 방지 (제목에 EP번호가 있어 회차 구분됨)
   */
  async function enqueueItems(conn, items, sourceRef, existing = []) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const it of items) {
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
        : it.is_duplicate ? `AI 중복 의심: ${it.dup_reason || '기존 일정 확인 필요'}`.slice(0, 255) : null;

      // 날짜가 생긴 경우: 같은 제목의 '미정' 대기 행이 있으면 채워서 업데이트
      if (hasDate) {
        const [u] = await conn.query(
          `SELECT id FROM bot_pending_schedules WHERE dedup_key = ? AND status = 'pending' AND created_schedule_id IS NULL LIMIT 1`,
          [queueKey({ title: it.title })]
        );
        if (u.length) {
          const newKey = queueKey(it);
          try {
            const [result] = await conn.query(
              // dup_hint도 같이 갱신한다 — 날짜가 정해져야 비로소 중복 판정이 되는데,
              // 여기서 안 넣으면 '미정'일 때 판정된 값(=항상 null)이 그대로 남아 표시가 안 뜬다
              `UPDATE bot_pending_schedules
                 SET date = ?, time = ?, category_name = ?, members = ?, venue_name = ?, description = ?, raw = ?, dedup_key = ?, source_ref = ?, dup_hint = ?
               WHERE id = ? AND status = 'pending' AND created_schedule_id IS NULL`,
              [it.date, it.time || null, it.category || '기타', members, it.venue_name || null, it.description || null, JSON.stringify(it), newKey, sourceRef, dupHint, u[0].id]
            );
            updated += result.affectedRows;
          } catch (e) {
            // 이미 같은 날짜|제목 행이 있으면(중복) 미정 행 제거
            if (e.code === 'ER_DUP_ENTRY') {
              await conn.query("DELETE FROM bot_pending_schedules WHERE id = ? AND status = 'pending' AND created_schedule_id IS NULL", [u[0].id]);
            } else {
              throw e;
            }
          }
          continue;
        }
      }

      const dedupKey = queueKey(it);
      const [[queued]] = await conn.query('SELECT id, status, created_schedule_id FROM bot_pending_schedules WHERE dedup_key = ? FOR UPDATE', [dedupKey]);
      if (queued) {
        if (queued.status === 'pending' && !queued.created_schedule_id) {
          await conn.query(`UPDATE bot_pending_schedules SET time = ?, category_name = ?, members = ?, venue_name = ?, description = ?, raw = ?, source_ref = ?, dup_hint = ? WHERE id = ?`,
            [it.time || null, it.category, members, it.venue_name || null, it.description || null, JSON.stringify(it), sourceRef, dupHint, queued.id]);
          updated++;
        }
        continue;
      }
      const [res] = await conn.query(
        `INSERT INTO bot_pending_schedules
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
  async function applyRun(run, bot) {
    const items = validateScheduleItems(parseJsonColumn(run.extracted_items));
    const existing = await fetchExistingSchedules();
    // 5) 신규(중복 아님)만 큐에 적재 (날짜 미정 포함)
    //    유튜브는 담당 봇이 있는 시리즈만 뺀다 — 비정기·1회성 출연은 봇이 예측 못 하므로 사람이 봐야 한다
    const coveredSeries = await fetchCoveredYoutubeSeries();
    const coveredByBot = (it) => {
      if (it.category !== YOUTUBE_CATEGORY) return false;
      const t = comparableTitle(it.title);
      return coveredSeries.some(k => t.includes(k));
    };

    //    멤버 생일도 뺀다 — members.birth_date로 매년 자동 생성되므로 큐에 담아봐야 중복이다.
    //    단 생일카페·지하철 광고처럼 그날 따로 열리는 행사는 별개 일정이라 남긴다.
    const birthdays = await fetchMemberBirthdays();
    const isMemberBirthday = (it) => {
      const t = comparableTitle(it.title);
      if (!/생일|생신/.test(t)) return false;
      if (BIRTHDAY_EVENT.test(t)) return false;
      const md = String(it.date || '').slice(5);
      return birthdays.some(b => (md && b.md === md) || (b.key.length === 2 && t.includes(b.key)));
    };

    const fresh = items.filter(
      it => it && it.title && !coveredByBot(it) && !isMemberBirthday(it)
    );

    const result = await withTransaction(db, async conn => {
      const [[current]] = await conn.query('SELECT queued_at FROM bot_collection_runs WHERE id = ? FOR UPDATE', [run.id]);
      if (current.queued_at) return { added: 0, updated: 0, skipped: 0 };
      const counts = await enqueueItems(conn, fresh, run.post_url.split('/').pop(), existing);
      await markStaleItems(conn, items, fastify.log);
      await logPost(conn, run.post_url, counts.added + counts.updated > 0 ? 'processed' : 'no_event', counts.added);
      await conn.query('UPDATE bot_collection_runs SET queued_at = NOW(), added_count = ?, notification_pending = ? WHERE id = ?', [counts.added, counts.added > 0 ? 1 : 0, run.id]);
      return counts;
    });
    if (result.added || result.updated) await logActivity(db, {
      actor: bot.id, action: 'sync_complete', category: 'sync',
      summary: `일정 수집 큐 반영: 신규 ${result.added}건 / 정보 갱신 ${result.updated}건`,
      details: { runId: run.id, ...result },
    });
    return { addedCount: result.added, total: items.length };
  }

  async function flushNotifications(bot) {
    let failure = null;
    const [runs] = await db.query('SELECT id, added_count FROM bot_collection_runs WHERE notification_pending = 1 ORDER BY created_at, id');
    for (const run of runs) {
      try {
        const result = await notify(db, {
          title: '새 일정 수집 대기',
          body: `수집 대기 ${run.added_count}건이 큐에 등록됐어요. 관리자 페이지에서 검토·등록하세요.`,
          data: { type: 'schedule_queue', eventId: run.id },
        });
        if (result.skipped || result.failed > 0) throw new Error('큐 알림을 발송하지 못했습니다');
        await db.query('UPDATE bot_collection_runs SET notification_pending = 0 WHERE id = ?', [run.id]);
      } catch (err) {
        await logActivity(db, { actor: bot.id, action: 'error', category: 'sync',
          summary: '큐는 저장됐지만 알림 발송 실패: 다음 수집 시 재시도', details: { runId: run.id, error: err.message } });
        failure ||= err;
      }
    }
    return failure;
  }

  async function syncNewFestivals(bot) {
    // Resume durable work before fetching a newer post or spending another AI request.
    let addedCount = 0, total = 0;
    const [unfinished] = await db.query('SELECT * FROM bot_collection_runs WHERE queued_at IS NULL ORDER BY created_at, id');
    for (const run of unfinished) {
      const result = await applyRun(run, bot);
      addedCount += result.addedCount; total += result.total;
    }
    const apiKey = fastify.config.gemini?.apiKey;
    if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
    const post = await fetchLatestSchedulePost(bot.searchUrl, fastify.log);
    if (!post || await isPostProcessed(post.postUrl)) return { addedCount, total };
    const bodyHash = hash(post.body);
    const runId = hash(`${post.postUrl}\n${bodyHash}`);
    const [[known]] = await db.query('SELECT * FROM bot_collection_runs WHERE id = ?', [runId]);
    if (known?.queued_at) return { addedCount, total };
    let run = known;
    if (!run) {
      const existing = await fetchExistingSchedules();
      const items = await extractScheduleItems(post.body, existing, apiKey, Number(todayKST().slice(0, 4)));
      await db.query('INSERT INTO bot_collection_runs (id, post_url, body_hash, extracted_items) VALUES (?, ?, ?, ?)', [runId, post.postUrl, bodyHash, JSON.stringify(items)]);
      run = { id: runId, post_url: post.postUrl, extracted_items: items };
    }
    const result = await applyRun(run, bot);
    return { addedCount: addedCount + result.addedCount, total: total + result.total };
  }

  fastify.decorate('festivalBot', {
    syncNewFestivals: bot => withIngestionLock(db, 'dc:collection', async () => {
      let result, error;
      try { result = await syncNewFestivals(bot); } catch (err) { error = err; }
      const notificationError = await flushNotifications(bot);
      if (error) throw error;
      if (notificationError) throw notificationError;
      return result;
    }),
  });
}

export default fp(festivalBotPlugin, {
  name: 'festivalBot',
  dependencies: ['db'],
});
