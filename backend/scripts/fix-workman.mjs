/**
 * 워크맨 채널 아카이브 정리 + 백필 (1회성)
 *
 * 문제 1 — 봇 필터 ["프로미스나인","지원"]의 '지원'이 김지원·매니저 지원·지원 부탁 등
 *          무관한 영상까지 통과시켰다 → 필터를 ["프로미스나인"]으로 축소.
 * 문제 2 — 워크돌 쇼츠는 제목에 키워드가 없고 설명란 해시태그(#프로미스나인)에만
 *          출연자가 있어 전부 걸러졌다 → 제목+설명 매칭(sync 코드 수정)으로 백필.
 *
 * 사용법: node scripts/fix-workman.mjs [--apply]
 */
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');
const KEY = process.env.GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';
const PAGES = Number(process.env.PAGES || 8); // playlistItems 페이지 수 (50개씩, 1 unit/페이지)

const norm = (s) => String(s || '').normalize('NFC').toLowerCase();
const FROMIS = '프로미스나인';

const c = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

const [[bot]] = await c.query(
  "SELECT id, channel_id, channel_name, title_filters FROM bot_youtube WHERE channel_name LIKE '%워크맨%'"
);
if (!bot) { console.log('워크맨 봇 없음'); process.exit(1); }
console.log(`봇 #${bot.id} ${bot.channel_name} — 현재 필터: ${bot.title_filters}`);

// ── 1. 아카이브 오염 제거: 제목+설명에 '프로미스나인' 없는 영상 삭제 ──
const [rows] = await c.query('SELECT video_id, title FROM videos WHERE channel_id = ?', [bot.channel_id]);
const descMap = {};
for (let i = 0; i < rows.length; i += 50) {
  const ids = rows.slice(i, i + 50).map((r) => r.video_id);
  const j = await (await fetch(`${API}/videos?part=snippet&id=${ids.join(',')}&key=${KEY}`)).json();
  for (const v of j.items || []) descMap[v.id] = v.snippet.description || '';
}
// 설명란이 비어 판별 불가한 영상 — 썸네일 육안 확인으로 프로미스나인 확정 (박지원 워크돌 쇼츠)
const KEEP = new Set(['1OGQ3p6ca_U']);
const bad = rows.filter(
  (r) => !KEEP.has(r.video_id) && !norm(`${r.title}\n${descMap[r.video_id] || ''}`).includes(FROMIS)
);
console.log(`\n아카이브 ${rows.length}건 중 무관 영상 ${bad.length}건 삭제 대상:`);
for (const r of bad) console.log(`   ${r.title.slice(0, 70)}`);

// ── 2. 일정 오염 확인 (exclude_shorts라 쇼츠는 없지만 일반 영상 오탐 가능) ──
const [sched] = await c.query(
  `SELECT s.id schedule_id, s.title FROM schedules s
   JOIN schedule_youtube sy ON sy.schedule_id = s.id
   WHERE sy.channel_id = ?`,
  [bot.channel_id]
);
// 일정은 영상 설명을 저장하지 않으므로 제목으로만 의심 건을 보고한다 (자동 삭제 안 함)
const badSched = sched.filter(
  (r) => !norm(r.title).includes(FROMIS) && !norm(r.title).includes('워크돌')
);
console.log(`\n일정 ${sched.length}건 중 오탐 의심 ${badSched.length}건:`);
for (const r of badSched) console.log(`   #${r.schedule_id} ${r.title.slice(0, 70)}`);

// ── 3. 백필: 채널 업로드에서 제목+설명 매칭 ──
const uploads = 'UU' + bot.channel_id.slice(2);
const found = [];
let token = '';
for (let p = 0; p < PAGES; p++) {
  const j = await (await fetch(
    `${API}/playlistItems?part=snippet&playlistId=${uploads}&maxResults=50&key=${KEY}${token ? `&pageToken=${token}` : ''}`
  )).json();
  if (j.error) { console.log('API 오류:', j.error.message); break; }
  for (const it of j.items || []) {
    const sn = it.snippet;
    if (sn.publishedAt >= '2025-01-26' && norm(`${sn.title}\n${sn.description || ''}`).includes(FROMIS)) {
      found.push({ videoId: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt });
    }
  }
  token = j.nextPageToken || '';
  if (!token) break;
}
const have = new Set(rows.map((r) => r.video_id));
const toAdd = found.filter((v) => !have.has(v.videoId));
console.log(`\n채널 스캔 ${PAGES}페이지 — 매칭 ${found.length}건, 신규 ${toAdd.length}건:`);
for (const v of toAdd) console.log(`   ${v.publishedAt.slice(0, 10)} ${v.title.slice(0, 66)}`);

if (!APPLY) {
  console.log('\n(dry run — 실제 반영하려면 --apply)');
  await c.end();
  process.exit(0);
}

// ── 반영 ──
if (bad.length) {
  await c.query(
    `DELETE FROM videos WHERE video_id IN (${bad.map(() => '?').join(',')})`,
    bad.map((r) => r.video_id)
  );
}
await c.query("UPDATE bot_youtube SET title_filters = ? WHERE id = ?", [JSON.stringify([FROMIS]), bot.id]);
await c.query('DELETE FROM youtube_skipped_videos WHERE channel_id = ?', [bot.channel_id]);

// 쇼츠 판별 후 적재
const durMap = {};
for (let i = 0; i < toAdd.length; i += 50) {
  const ids = toAdd.slice(i, i + 50).map((v) => v.videoId);
  const j = await (await fetch(`${API}/videos?part=contentDetails&id=${ids.join(',')}&key=${KEY}`)).json();
  for (const v of j.items || []) {
    const m = (v.contentDetails.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    durMap[v.id] = m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }
}
async function isShorts(id, sec) {
  if (sec > 180) return false;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) return false;
    if (res.status === 200) return true;
  } catch { /* 폴백 */ }
  return sec <= 60;
}
let added = 0;
for (const v of toAdd) {
  const shorts = await isShorts(v.videoId, durMap[v.videoId] ?? 999);
  const [r] = await c.query(
    `INSERT IGNORE INTO videos (video_id, channel_id, channel_name, title, category, video_type, published_at)
     VALUES (?, ?, ?, ?, 'variety', ?, ?)`,
    [v.videoId, bot.channel_id, bot.channel_name, v.title, shorts ? 'shorts' : 'video',
     new Date(new Date(v.publishedAt).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')]
  );
  if (r.affectedRows > 0) added++;
}
console.log(`\n반영 완료 — 삭제 ${bad.length}건, 신규 적재 ${added}건, 필터 ["프로미스나인"], 스킵 캐시 초기화`);
await c.end();
