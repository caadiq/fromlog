/**
 * 영상 아카이브 백필 (1회성)
 * 1. 기존 schedule_youtube(수동 등록 포함) → videos 임포트
 * 2. 봇 채널별 업로드 재생목록 전체 페이징 → 제목 필터 → 쇼츠 판별 → videos 적재
 */
import mysql from 'mysql2/promise';
import { tagFancamMembers } from '../src/services/videos.js';

const KEY = process.env.GOOGLE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';
const norm = (s) => String(s || '').normalize('NFC').toLowerCase();
let units = 0;

const c = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

const [bots] = await c.query('SELECT * FROM bot_youtube');
const botByChannel = new Map(bots.map((b) => [b.channel_id, b]));

function toKst(iso) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function parseDur(d) {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

async function insertVideo(v) {
  const members = v.category === 'fancam' ? JSON.stringify(tagFancamMembers(v.title)) : null;
  const [r] = await c.query(
    `INSERT IGNORE INTO videos (video_id, channel_id, channel_name, title, category, video_type, published_at, members)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.videoId, v.channelId, v.channelName || null, v.title, v.category, v.videoType, v.publishedAt, members]
  );
  return r.affectedRows > 0;
}

function inferCat(channelId, title) {
  const bot = botByChannel.get(channelId);
  if (bot) return bot.video_category || 'variety';
  if (/직캠|fancam|페이스캠|facecam|풀캠/i.test(title)) return 'fancam';
  return 'variety';
}

// ── 1. 기존 schedule_youtube 임포트 ──
const [rows] = await c.query(`
  SELECT sy.video_id, sy.video_type, sy.channel_id, sy.channel_name, s.title, s.date, s.time
  FROM schedule_youtube sy JOIN schedules s ON s.id = sy.schedule_id
  WHERE sy.video_id IS NOT NULL`);
let imported = 0;
for (const r of rows) {
  const d = new Date(r.date);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ok = await insertVideo({
    videoId: r.video_id, channelId: r.channel_id || '', channelName: r.channel_name,
    title: r.title, category: inferCat(r.channel_id, r.title),
    videoType: r.video_type || 'video',
    publishedAt: `${dateStr} ${r.time || '00:00:00'}`,
  });
  if (ok) imported++;
}
console.log(`1) schedule_youtube 임포트: ${imported}/${rows.length}`);

// ── 2. 봇 채널 전체 백필 ──
async function jget(url) {
  const res = await fetch(url);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

async function isShortsCheck(id, sec) {
  if (sec > 180) return false;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) return false;
    if (res.status === 200) return true;
  } catch {}
  return sec <= 60;
}

for (const bot of bots) {
  if (bot.enabled !== 1) { console.log(`- ${bot.channel_name}: 비활성, 건너뜀`); continue; }
  // 아카이브 전용 봇(음방 채널)은 업로드가 수만 건이라 전체 페이징이 비현실적 —
  // scripts/backfill-fancam.mjs(search.list 기반)가 담당한다.
  if (bot.add_to_schedule === 0) { console.log(`- ${bot.channel_name}: 아카이브 전용(검색 백필 담당), 건너뜀`); continue; }
  const filters = bot.title_filters ? JSON.parse(bot.title_filters) : null;
  const pl = await jget(`${API}/channels?part=contentDetails&id=${bot.channel_id}&key=${KEY}`);
  units += 1;
  const uploadsId = pl.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) { console.log(`- ${bot.channel_name}: 업로드 재생목록 없음`); continue; }

  const matched = [];
  let pageToken = '', total = 0;
  do {
    const j = await jget(`${API}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`);
    units += 1;
    total += j.items.length;
    for (const it of j.items) {
      const title = it.snippet.title;
      if (filters && filters.length > 0 && !filters.some((f) => norm(title).includes(norm(f)))) continue;
      matched.push({ videoId: it.snippet.resourceId.videoId, title, publishedAt: it.snippet.publishedAt });
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);

  // duration 배치 (매칭분만)
  const durMap = {};
  for (let i = 0; i < matched.length; i += 50) {
    const ids = matched.slice(i, i + 50).map((m) => m.videoId);
    const j = await jget(`${API}/videos?part=contentDetails&id=${ids.join(',')}&key=${KEY}`);
    units += 1;
    for (const v of j.items) durMap[v.id] = parseDur(v.contentDetails.duration);
  }

  let added = 0, shortsCnt = 0;
  for (const m of matched) {
    const sec = durMap[m.videoId] ?? 999;
    const shorts = await isShortsCheck(m.videoId, sec);
    if (shorts) shortsCnt++;
    const ok = await insertVideo({
      videoId: m.videoId, channelId: bot.channel_id, channelName: bot.channel_name,
      title: m.title, category: bot.video_category || 'variety',
      videoType: shorts ? 'shorts' : 'video', publishedAt: toKst(m.publishedAt),
    });
    if (ok) added++;
  }
  console.log(`- ${bot.channel_name}: 전체 ${total}, 매칭 ${matched.length}, 신규 ${added} (쇼츠 ${shortsCnt})`);
}

const [[{ n }]] = await c.query('SELECT COUNT(*) n FROM videos');
const [cats] = await c.query('SELECT category, COUNT(*) n FROM videos GROUP BY category');
console.log(`완료 — videos 총 ${n}개, 카테고리:`, JSON.stringify(cats), `API 사용 ${units} units`);
await c.end();
