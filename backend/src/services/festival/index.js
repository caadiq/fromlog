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

// DC봇이 큐에 담지 않을 카테고리 — 유튜브는 유튜브 봇들이 전담(스프·이단장·워크돌·입덕투어 등 채널 추적 중)
const SKIP_CATEGORIES = new Set(['유튜브']);

/** 제목 정규화 (공백 제거 + 소문자) — 큐 dedup_key용 */
function normalizeTitle(title) {
  return String(title || '').replace(/\s+/g, '').toLowerCase();
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
  async function enqueueItems(items, sourceRef) {
    let added = 0;
    let updated = 0;
    for (const it of items) {
      const titleKey = normalizeTitle(it.title);
      const hasDate = !!it.date;
      const members = JSON.stringify(Array.isArray(it.members) ? it.members : []);

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
           (source, source_ref, category_name, title, date, time, members, venue_name, description, raw, dedup_key)
         VALUES ('dc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          dedupKey,
        ]
      );
      if (res.affectedRows > 0) added++;
    }
    return { added, updated };
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

    // 5) 신규(중복 아님)만 큐에 적재 (날짜 미정 포함, 유튜브 제외 — 유튜브 봇 전담)
    const fresh = items.filter(it => it && it.title && !it.is_duplicate && !SKIP_CATEGORIES.has(it.category));
    const { added, updated } = await enqueueItems(fresh, String(post.postNo));

    // 6) 글 처리 완료 기록
    await logPost(post.postUrl, (added + updated) > 0 ? 'processed' : 'no_event', added);

    fastify.log.info(`[dcbot] 추출 ${items.length} / 신규 ${fresh.length} / 큐 적재 ${added} / 날짜채움 ${updated}`);

    // 7) 새로 적재된 게 있으면 관리자에게 푸시
    if (added > 0) {
      try {
        await sendOpsAlert(db, {
          title: '새 일정 수집 대기',
          body: `수집 대기 ${added}건이 큐에 등록됐어요. 관리자에서 검토·등록하세요.`,
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
