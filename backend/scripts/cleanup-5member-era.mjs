/**
 * 영상 아카이브 5인 체제 정리 (1회성)
 *
 * 1. 5인 체제(2025-01-26) 이전 업로드 영상 제거
 * 2. 컷 이후 업로드됐지만 8인 무대인 2024 MBC 가요대제전 영상 제거
 * 3. 비공개/삭제된 영상 제거
 * 4. video로 저장됐지만 실제 쇼츠인 것 video_type 교정
 * 5. 예능·기타에 남은 퍼포먼스 영상(NPOP CAM·KGMA 무대) → 무대·퍼포먼스
 *
 * 사용법: node scripts/cleanup-5member-era.mjs [--apply]
 */
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');
const CUT = '2025-01-26';

const c = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

// 1+2. 5인 체제 이전 콘텐츠
const [old] = await c.query('SELECT COUNT(*) n FROM videos WHERE published_at < ?', [CUT]);
const [gj] = await c.query(
  `SELECT video_id, title FROM videos WHERE published_at >= ?
   AND (title LIKE '%가요대제전%' AND (title LIKE '%2024%' OR published_at < '2025-03-01'))`, [CUT]);
console.log(`컷 이전 업로드: ${old[0].n}건`);
console.log(`컷 이후 2024 가요대제전: ${gj.length}건`);
for (const r of gj) console.log(`   ${r.title.slice(0, 66)}`);

// 3+4. 컷 이후 남을 영상을 대상으로 비공개/쇼츠를 API로 직접 재판별
//      (제목 하드코딩은 공백·이모지 차이로 새서 신뢰할 수 없다)
const KEY = process.env.GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';
const gjIds = new Set(gj.map((r) => r.video_id));
const [remain] = await c.query('SELECT video_id, title, video_type FROM videos WHERE published_at >= ?', [CUT]);
const target = remain.filter((r) => !gjIds.has(r.video_id));

const durMap = {};
for (let i = 0; i < target.length; i += 50) {
  const ids = target.slice(i, i + 50).map((r) => r.video_id);
  const j = await (await fetch(`${API}/videos?part=contentDetails&id=${ids.join(',')}&key=${KEY}`)).json();
  for (const v of j.items || []) {
    const m = (v.contentDetails.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    durMap[v.id] = m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }
}
const priv = target.filter((r) => durMap[r.video_id] === undefined);
console.log(`\n비공개/삭제: ${priv.length}건`);
for (const r of priv) console.log(`   ${r.title.slice(0, 66)}`);

const shortsRows = [];
for (const r of target) {
  if (r.video_type !== 'video') continue;
  const sec = durMap[r.video_id];
  if (sec === undefined || sec > 180) continue;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${r.video_id}`, { method: 'HEAD', redirect: 'manual' });
    if (res.status === 200) shortsRows.push(r);
  } catch { /* 판별 불가 시 유지 */ }
}
console.log(`\n쇼츠로 교정: ${shortsRows.length}건`);
for (const r of shortsRows) console.log(`   ${r.title.slice(0, 66)}`);

// 5. 퍼포먼스 재분류
const [perf] = await c.query(
  `SELECT video_id, title FROM videos WHERE category='variety'
   AND (channel_name = 'NPOP' AND title LIKE '%NPOP CAM%'
     OR channel_name = 'KGMA_OFFICIAL' AND title LIKE '%KGMA%')`);
console.log(`\n무대·퍼포먼스로 이동: ${perf.length}건`);
for (const r of perf) console.log(`   ${r.title.slice(0, 66)}`);

if (!APPLY) {
  console.log('\n(dry run — 실제 반영하려면 --apply)');
  await c.end();
  process.exit(0);
}

await c.query('DELETE FROM videos WHERE published_at < ?', [CUT]);
if (gj.length) await c.query(`DELETE FROM videos WHERE video_id IN (${gj.map(() => '?').join(',')})`, gj.map((r) => r.video_id));
if (priv.length) await c.query(`DELETE FROM videos WHERE video_id IN (${priv.map(() => '?').join(',')})`, priv.map((r) => r.video_id));
if (shortsRows.length) await c.query(`UPDATE videos SET video_type='shorts' WHERE video_id IN (${shortsRows.map(() => '?').join(',')})`, shortsRows.map((r) => r.video_id));
if (perf.length) await c.query(`UPDATE videos SET category='music' WHERE video_id IN (${perf.map(() => '?').join(',')})`, perf.map((r) => r.video_id));

const [after] = await c.query('SELECT category, COUNT(*) n FROM videos GROUP BY category');
console.log('\n반영 완료 —', after.map((r) => `${r.category} ${r.n}`).join(' / '));
await c.end();
