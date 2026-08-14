/**
 * 예정(is_temp) 유튜브 일정 승격
 *
 * 예정 일정은 두 곳에서 만들어진다.
 *   1) 유튜브 봇의 auto_schedule_config — 정기 업로드 채널의 다음 회차를 미리 깔아둔다
 *   2) 수집 큐(DC봇) — 봇이 담당하지 않는 비정기 콘텐츠를 관리자가 예정으로 등록한다
 *
 * (1)은 봇이 `채널 id + 날짜`로 자기 예정 일정을 찾아 채운다(services/youtube의 findScheduledEntry).
 * (2)는 채널을 모르고 날짜도 예고라 어긋날 수 있어 그 방식으로는 못 찾는다.
 * 그래서 여기서는 **제목 포함관계**로 찾는다 — 예고 제목은 실제 영상 제목 안에 거의 그대로 들어간다.
 *   예고 "K판 입덕투어2 EP.9" ⊂ 실제 "⚠️ 심쿵 주의 ⚠️ … | 프로미스나인 … K판 입덕투어2 EP.9"
 *
 * 이 고리가 없으면 예정 일정은 영상이 올라와도 안 채워지고, 그 사이 다른 경로(X봇 등)가
 * 같은 영상으로 일정을 새로 만들어 달력에 같은 회차가 두 번 뜬다.
 */
import { withTransaction } from './transaction.js';
import { CATEGORY_IDS } from '../config/index.js';
import { syncScheduleById } from '../services/meilisearch/index.js';

/** 예고 날짜가 어긋나도 잡을 범위 (예고는 미뤄지거나 당겨진다) */
const DATE_SLACK_DAYS = 7;

/**
 * 제목이 짧으면 아무 영상에나 걸린다.
 * 'ME' 같은 두 글자가 통과하면 엉뚱한 예정 일정을 덮어쓴다.
 */
const MIN_TITLE_CHARS = 6;

/** 대조용 정규화 — 공백·구두점·이모지를 걷어내고 소문자로 */
function comparableTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '');
}

/**
 * 이 영상으로 채울 예정 일정을 찾아 승격시킨다.
 *
 * @param {object} db - mysql2 pool
 * @param {object} video - { videoId, videoType, channelId, channelName, title, date, time }
 * @returns {Promise<number|null>} 승격한 schedule_id, 없으면 null
 */
export async function promoteTempSchedule(db, video) {
  if (!video?.videoId || !video?.title) return null;

  const target = comparableTitle(video.title);
  if (target.length < MIN_TITLE_CHARS) return null;

  const [rows] = await db.query(
    `SELECT s.id, s.title
       FROM schedules s
       JOIN schedule_youtube sy ON sy.schedule_id = s.id
      WHERE s.is_temp = 1
        AND s.category_id = ?
        AND sy.video_id IS NULL
        AND s.date BETWEEN DATE_SUB(?, INTERVAL ? DAY) AND DATE_ADD(?, INTERVAL ? DAY)
      ORDER BY ABS(DATEDIFF(s.date, ?))`,
    [CATEGORY_IDS.YOUTUBE, video.date, DATE_SLACK_DAYS, video.date, DATE_SLACK_DAYS, video.date]
  );
  if (rows.length === 0) return null;

  // 날짜가 가장 가까운 것부터 본다 — 같은 시리즈의 예정이 여러 개 깔려 있을 수 있다
  const match = rows.find((r) => {
    const pending = comparableTitle(r.title);
    return pending.length >= MIN_TITLE_CHARS && target.includes(pending);
  });
  if (!match) return null;

  await withTransaction(db, async (conn) => {
    await conn.query(
      'UPDATE schedules SET title = ?, date = ?, time = ?, is_temp = 0 WHERE id = ?',
      [video.title, video.date, video.time, match.id]
    );
    // 큐에서 만든 예정 일정은 채널이 비어 있으므로 여기서 함께 채운다
    await conn.query(
      'UPDATE schedule_youtube SET video_id = ?, video_type = ?, channel_id = ?, channel_name = ? WHERE schedule_id = ?',
      [video.videoId, video.videoType, video.channelId ?? null, video.channelName ?? null, match.id]
    );
  });

  return match.id;
}

/**
 * 예정 유튜브 일정 생성 (수집 큐에서 등록할 때 쓴다).
 *
 * 영상이 아직 없으므로 video_id·채널은 비워둔다. 나중에 영상이 올라오면
 * [promoteTempSchedule]이 제목으로 찾아 채운다.
 *
 * @returns {Promise<number>} 만들어진 schedule_id
 */
export async function createTempYoutubeSchedule(db, meilisearch, { title, date, time }) {
  const scheduleId = await withTransaction(db, async (conn) => {
    const [result] = await conn.query(
      'INSERT INTO schedules (category_id, title, date, time, is_temp) VALUES (?, ?, ?, ?, 1)',
      [CATEGORY_IDS.YOUTUBE, title, date, time || null]
    );
    const sid = result.insertId;
    await conn.query(
      'INSERT INTO schedule_youtube (schedule_id, video_id, video_type) VALUES (?, NULL, ?)',
      [sid, 'video']
    );
    return sid;
  });

  await syncScheduleById(meilisearch, db, scheduleId);
  return scheduleId;
}

export { comparableTitle };
