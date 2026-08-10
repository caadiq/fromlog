/**
 * 봇의 예정 일정 회차 표기 설정
 *
 * auto_schedule_config의 titleTemplate/episodeMatch/episodeOffset을 바꾸고,
 * 이미 만들어져 있는 예정(is_temp=1) 일정 제목도 새 규칙으로 다시 쓴다.
 *
 * 회차 번호는 백엔드 generateScheduledTitle과 같은 식으로 계산한다:
 *   (제목에 episodeMatch가 든 일정 영상 수) + 1 + episodeOffset
 *
 * 사용법:
 *   node scripts/set-episode-template.mjs --bot=6 \
 *     --template='이단장 시즌2 EP.{episode}' --match='이단장 시즌2' [--offset=0] [--apply]
 */
import mysql from 'mysql2/promise';
import { MeiliSearch } from 'meilisearch';
import Redis from 'ioredis';
import config from '../src/config/index.js';
import { syncScheduleById } from '../src/services/meilisearch/index.js';

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const APPLY = process.argv.includes('--apply');
const BOT_ID = Number(arg('bot'));
const TEMPLATE = arg('template');
const MATCH = arg('match', null);
const OFFSET = Number(arg('offset', 0));

if (!BOT_ID || !TEMPLATE) {
  console.log("사용법: --bot=<id> --template='... EP.{episode}' [--match=...] [--offset=N] [--apply]");
  process.exit(1);
}

const db = await mysql.createConnection({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

const [[bot]] = await db.query(
  'SELECT id, channel_id, channel_name, auto_schedule_config FROM bot_youtube WHERE id = ?',
  [BOT_ID]
);
if (!bot) {
  console.log(`봇 ${BOT_ID}을(를) 찾을 수 없습니다.`);
  await db.end();
  process.exit(1);
}

const current =
  typeof bot.auto_schedule_config === 'string'
    ? JSON.parse(bot.auto_schedule_config)
    : bot.auto_schedule_config;
if (!current) {
  console.log(`봇 ${BOT_ID}(${bot.channel_name})에 auto_schedule_config가 없습니다.`);
  await db.end();
  process.exit(1);
}

const next = { ...current, titleTemplate: TEMPLATE, episodeOffset: OFFSET };
if (MATCH) next.episodeMatch = MATCH;
else delete next.episodeMatch;

// 회차 계산 — 백엔드 getVideoCount와 동일 조건
const params = [bot.channel_id];
let sql = `SELECT COUNT(*) as cnt FROM schedule_youtube sy
   WHERE sy.channel_id = ? AND sy.video_type = 'video' AND sy.video_id IS NOT NULL`;
if (MATCH) {
  sql += ` AND EXISTS (SELECT 1 FROM schedules s WHERE s.id = sy.schedule_id AND s.title LIKE ?)`;
  params.push(`%${MATCH}%`);
}
const [[{ cnt }]] = await db.query(sql, params);
const episode = cnt + 1 + OFFSET;
const title = TEMPLATE.replace('{channelName}', bot.channel_name).replace('{episode}', episode);

console.log(`봇 ${BOT_ID} · ${bot.channel_name}`);
console.log(`  이전 제목: ${current.titleTemplate || current.title || '(없음)'}`);
console.log(`  세어진 영상: ${cnt}편${MATCH ? ` (제목에 '${MATCH}' 포함)` : ''}`);
console.log(`  다음 회차 제목: "${title}"`);

// 이미 있는 예정 일정
const [temps] = await db.query(
  `SELECT s.id, s.date, s.title FROM schedule_youtube sy
   JOIN schedules s ON s.id = sy.schedule_id
   WHERE sy.channel_id = ? AND s.is_temp = 1`,
  [bot.channel_id]
);
for (const t of temps) {
  console.log(`  예정 일정 ${t.date.toISOString().slice(0, 10)}: "${t.title}" → "${title}"`);
}

if (!APPLY) {
  console.log('\n(미적용 — --apply 를 붙이면 실제로 반영)');
  await db.end();
  process.exit(0);
}

await db.query('UPDATE bot_youtube SET auto_schedule_config = ? WHERE id = ?', [
  JSON.stringify(next),
  BOT_ID,
]);
console.log('✓ 봇 설정 반영');

if (temps.length > 0) {
  const meilisearch = new MeiliSearch({
    host: config.meilisearch.host,
    apiKey: config.meilisearch.apiKey,
  });
  const redis = new Redis({ host: config.redis.host, port: config.redis.port });
  for (const t of temps) {
    await db.query('UPDATE schedules SET title = ? WHERE id = ?', [title, t.id]);
    await syncScheduleById(meilisearch, db, t.id, redis);
  }
  await redis.quit();
  console.log(`✓ 예정 일정 ${temps.length}건 제목 갱신`);
}

console.log('\n⚠ 봇은 시작 시점 설정을 물고 있어 백엔드 재기동이 필요합니다.');
await db.end();
