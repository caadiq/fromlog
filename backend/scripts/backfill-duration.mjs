/**
 * 기존 영상의 duration(초) 백필
 *
 * 쇼츠는 표시하지 않으므로 일반 영상만 채운다.
 * videos.list는 한 번에 50개까지 조회되고 1 unit이라 비용이 거의 없다.
 *
 * 사용법: node scripts/backfill-duration.mjs [--apply] [--include-shorts]
 */
import mysql from 'mysql2/promise';
import config from '../src/config/index.js';

const KEY = config.google.apiKey;
const API = 'https://www.googleapis.com/youtube/v3';
const APPLY = process.argv.includes('--apply');
const INCLUDE_SHORTS = process.argv.includes('--include-shorts');

/** ISO 8601 duration (PT1M30S) → 초 */
function parseDuration(d) {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

const db = await mysql.createConnection({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

const typeCond = INCLUDE_SHORTS ? '' : " AND video_type = 'video'";
const [rows] = await db.query(
  `SELECT video_id FROM videos WHERE duration IS NULL${typeCond}`
);
console.log(`대상 ${rows.length}건 (videos.list ${Math.ceil(rows.length / 50)}콜)`);

if (rows.length === 0) {
  await db.end();
  process.exit(0);
}
if (!APPLY) {
  console.log('\n(미적용 — --apply 를 붙이면 실제로 반영)');
  await db.end();
  process.exit(0);
}

let filled = 0;
let missing = 0;
for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50).map((r) => r.video_id);
  const res = await fetch(
    `${API}/videos?part=contentDetails&id=${batch.join(',')}&key=${KEY}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const found = new Set();
  for (const v of data.items || []) {
    const seconds = parseDuration(v.contentDetails.duration);
    // 프리미어/라이브 예정은 duration이 0이라 저장하지 않는다 (다음 실행에서 재시도)
    if (seconds > 0) {
      await db.query('UPDATE videos SET duration = ? WHERE video_id = ?', [seconds, v.id]);
      filled++;
      found.add(v.id);
    }
  }
  // 삭제·비공개된 영상은 응답에 없다
  missing += batch.filter((id) => !found.has(id)).length;
  console.log(`  ${Math.min(i + 50, rows.length)}/${rows.length} …`);
}

console.log(`\n✓ ${filled}건 저장${missing ? `, ${missing}건은 길이를 못 받음(삭제·비공개·프리미어)` : ''}`);
await db.end();
