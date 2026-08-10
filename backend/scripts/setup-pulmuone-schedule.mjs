/**
 * 풀무원 「이아이는요2」 정기 업로드 일정 설정 (1회성)
 *
 * 시즌2는 격주 금요일 17:00 업로드 (6/26 EP.1 이후 14일 간격 고정).
 * auto_schedule_config를 넣고, 이미 지나간 EP.4(8/7) 시점에는 봇이 없어
 * 만들어지지 못한 다음 회차 예정 일정(8/21)을 직접 생성한다.
 *
 * 사용법: node scripts/setup-pulmuone-schedule.mjs [--apply]
 */
import mysql from 'mysql2/promise';
import { MeiliSearch } from 'meilisearch';
import Redis from 'ioredis';
import config, { CATEGORY_IDS } from '../src/config/index.js';
import { syncScheduleById, deleteSchedule } from '../src/services/meilisearch/index.js';

const APPLY = process.argv.includes('--apply');
const BOT_ID = 15;
const CHANNEL_ID = 'UC1UebYbC2j7M_IUHADtqOag';
const YOUTUBE_CATEGORY_ID = CATEGORY_IDS.YOUTUBE;
const NEXT_DATE = '2026-08-21';

const CONFIG = {
  dayOfWeek: 5, // 금
  weeksAhead: 2, // 격주
  time: '17:00:00',
  titleTemplate: '이아이는요2 EP.{episode}', // 실제 영상 제목이 'EP.4' 표기라 맞춤
  episodeMatch: '이아이는요2', // 광고 영상·시즌1은 회차 수에서 제외 (시즌2 5편 모두 제목에 있음)
  episodeOffset: -1, // 6/19 예고편이 개수에 포함돼 실제 회차보다 1 앞선다
  deadlineDayOfWeek: 6, // 토 — 금요일에 안 올라오면 예정 삭제 후 다음 회차로
};

// 제목 필터도 좁힌다. '이아이는요'로 두면 시즌1(승헌쓰&쥴리 진행)까지 걸리는데,
// 시즌1은 프로미스나인·송하영이 제목/설명 어디에도 없는 무관한 회차다.
const TITLE_FILTERS = ['프로미스나인', '송하영', '이아이는요2'];

const db = await mysql.createConnection({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

console.log('설정할 auto_schedule_config:', JSON.stringify(CONFIG));

if (!APPLY) {
  console.log('\n(미적용 — --apply 를 붙이면 실제로 반영)');
  await db.end();
  process.exit(0);
}

await db.query(
  'UPDATE bot_youtube SET auto_schedule_config = ?, title_filters = ? WHERE id = ?',
  [JSON.stringify(CONFIG), JSON.stringify(TITLE_FILTERS), BOT_ID]
);
console.log('✓ 봇 설정 반영 (제목 필터 포함)');

const meilisearch = new MeiliSearch({
  host: config.meilisearch.host,
  apiKey: config.meilisearch.apiKey,
});
const redis = new Redis({ host: config.redis.host, port: config.redis.port });

// 넓은 필터로 잘못 유입된 시즌1 일정 제거
const [stale] = await db.query(
  `SELECT s.id, s.title FROM schedule_youtube sy
   JOIN schedules s ON s.id = sy.schedule_id
   WHERE sy.channel_id = ? AND s.title LIKE '%이아이는요%' AND s.title NOT LIKE '%이아이는요2%'`,
  [CHANNEL_ID]
);
for (const row of stale) {
  await db.query('DELETE FROM schedule_youtube WHERE schedule_id = ?', [row.id]);
  await db.query('DELETE FROM schedules WHERE id = ?', [row.id]);
  await deleteSchedule(meilisearch, row.id, redis);
  console.log(`  - 시즌1 일정 삭제: ${row.title.slice(0, 40)}`);
}
if (stale.length) console.log(`✓ 시즌1 ${stale.length}건 정리`);

// 다음 회차 번호 — 백엔드 generateScheduledTitle과 같은 계산식
const [[{ cnt }]] = await db.query(
  `SELECT COUNT(*) as cnt FROM schedule_youtube sy
   WHERE sy.channel_id = ? AND sy.video_type = 'video' AND sy.video_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM schedules s WHERE s.id = sy.schedule_id AND s.title LIKE ?)`,
  [CHANNEL_ID, `%${CONFIG.episodeMatch}%`]
);
const episode = cnt + 1 + CONFIG.episodeOffset;
const title = CONFIG.titleTemplate.replace('{episode}', episode);
console.log(`· 회차 계산: 기존 ${cnt}편 → 다음 EP.${episode} → "${title}"`);

// 예정 일정 — 이미 있으면 제목만 갱신
const [dup] = await db.query(
  `SELECT sy.schedule_id FROM schedule_youtube sy
   JOIN schedules s ON s.id = sy.schedule_id
   WHERE sy.channel_id = ? AND s.date = ? AND s.is_temp = 1`,
  [CHANNEL_ID, NEXT_DATE]
);

let scheduleId;
if (dup.length > 0) {
  scheduleId = dup[0].schedule_id;
  await db.query('UPDATE schedules SET title = ? WHERE id = ?', [title, scheduleId]);
  console.log(`✓ 예정 일정 제목 갱신 (id ${scheduleId})`);
} else {
  const [res] = await db.query(
    'INSERT INTO schedules (category_id, title, date, time, is_temp) VALUES (?, ?, ?, ?, 1)',
    [YOUTUBE_CATEGORY_ID, title, NEXT_DATE, CONFIG.time]
  );
  scheduleId = res.insertId;
  await db.query(
    `INSERT INTO schedule_youtube (schedule_id, video_id, video_type, channel_id, channel_name)
     VALUES (?, NULL, 'video', ?, ?)`,
    [scheduleId, CHANNEL_ID, '풀무원 Pulmuone']
  );
  console.log(`✓ 예정 일정 생성 (id ${scheduleId}) ${NEXT_DATE} ${CONFIG.time}`);
}

await syncScheduleById(meilisearch, db, scheduleId, redis);
await redis.quit();

await db.end();
