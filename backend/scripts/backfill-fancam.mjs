/**
 * 음방 채널 직캠·무대 영상 백필 (1회성)
 *
 * 채널 업로드가 수만 건이라 playlistItems 페이징은 비현실적이어서
 * search.list(채널 한정 + 검색어)로 프로미스나인 영상만 좁혀 가져온다.
 * search.list는 호출당 100 units이므로 채널별 페이지 수를 제한한다.
 */
import mysql from 'mysql2/promise';
import { tagFancamMembers } from '../src/services/videos.js';
import { loadSongTitles, classifyMusicTitle } from '../src/services/videoCategory.js';

const KEY = process.env.GOOGLE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';
const MAX_PAGES = Number(process.env.MAX_PAGES || 6); // 채널당 최대 페이지 (100 units씩)

/** 수집 대상 음방·직캠 채널 */
const CHANNELS = [
  ['M2', 'UCTQVIXvcHrR9jYoJ6qaBAow'],
  ['KBS Kpop', 'UCeLPm9yH_a_QH8n6445G-Ow'],
  ['MBCkpop', 'UCe52oeb7Xv_KaJsEzcKXJJg'],
  ['SBSKPOP X INKIGAYO', 'UCS_hnpJLQTvBkqALgapi_4g'],
  ['SBSKPOP ZOOM', 'UCM3jwNRfl5-W8VzgT6DsaEQ'],
  ['Mnet K-POP', 'UCbD8EppRX3ZwJSou-TVo90A'], // 엠카운트다운 본방송
  ['STUDIO CHOOM', 'UCEIi7zFR_wE23jFncVtd6-A'], // 안무 영상 (출연 빈도 낮음)
];

const FANCAM_RE = /직캠|fancam|페이스캠|풀캠|얼빡/i;
// 인터뷰·예능성 콘텐츠는 아카이브 대상이 아니다
const SKIP_RE = /인터뷰|interview|Oh, K!/i;
const FROMIS_RE = /프로미스나인|fromis/i;

let units = 0;

const c = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

function decode(s) {
  return String(s || '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function toKst(iso) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function parseDur(d) {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

async function isShorts(id, sec) {
  if (sec > 180) return false;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) return false;
    if (res.status === 200) return true;
  } catch {}
  return sec <= 60;
}

const songs = await loadSongTitles(c);

let totalAdded = 0;
for (const [name, channelId] of CHANNELS) {
  const collected = [];
  let pageToken = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API}/search?part=snippet&channelId=${channelId}&q=${encodeURIComponent('프로미스나인')}`
      + `&type=video&order=date&maxResults=50&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const j = await (await fetch(url)).json();
    units += 100;
    if (j.error) { console.log(`${name}: 오류 ${j.error.message}`); break; }
    for (const it of j.items || []) {
      const title = decode(it.snippet.title);
      // 검색어만 걸린 타 아티스트 영상 제외 — 제목에 그룹명이 있어야 함
      if (!FROMIS_RE.test(title)) continue;
      if (SKIP_RE.test(title)) continue;
      if (it.snippet.publishedAt < '2025-01-26') continue; // 5인 체제 이전 제외
      collected.push({ videoId: it.id.videoId, title, publishedAt: it.snippet.publishedAt });
    }
    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
  }

  // duration 배치 조회 (쇼츠 판별용)
  const durMap = {};
  for (let i = 0; i < collected.length; i += 50) {
    const ids = collected.slice(i, i + 50).map((v) => v.videoId);
    const j = await (await fetch(`${API}/videos?part=contentDetails&id=${ids.join(',')}&key=${KEY}`)).json();
    units += 1;
    for (const v of j.items || []) durMap[v.id] = parseDur(v.contentDetails.duration);
  }

  let added = 0, fancamCnt = 0;
  for (const v of collected) {
    // 음방 채널도 자체 예능을 올리므로 제목으로 무대/예능을 가른다
    const isFancam = FANCAM_RE.test(v.title);
    const category = classifyMusicTitle(v.title, songs);
    const shorts = await isShorts(v.videoId, durMap[v.videoId] ?? 999);
    const members = isFancam ? JSON.stringify(tagFancamMembers(v.title)) : null;
    const [r] = await c.query(
      `INSERT IGNORE INTO videos
         (video_id, channel_id, channel_name, title, category, video_type, published_at, members)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.videoId, channelId, name, v.title, category, shorts ? 'shorts' : 'video', toKst(v.publishedAt), members]
    );
    if (r.affectedRows > 0) { added++; if (isFancam) fancamCnt++; }
  }
  totalAdded += added;
  console.log(`- ${name}: 매칭 ${collected.length} / 신규 ${added} (직캠 ${fancamCnt})`);
}

const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM videos WHERE category='music'");
console.log(`\n완료 — 신규 ${totalAdded}건, 음방 총 ${n}건, API 사용 ${units} units`);
await c.end();
