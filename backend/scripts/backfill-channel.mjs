/**
 * 봇 미등록 채널 과거 영상 백필 (범용)
 *
 * 채널 업로드를 스캔해 제목+설명란에 키워드가 있는 영상만 아카이브에 넣는다.
 * 카테고리는 제목 판별(classifyMusicTitle)로 무대/기타를 가른다.
 * 5인 체제 이전 업로드는 archiveVideo가 거부한다.
 *
 * 사용법:
 *   node scripts/backfill-channel.mjs --channel=@musinsatv --match=프로미스나인,이채영 [--pages=8] [--apply]
 *   (--channel은 @핸들 또는 채널 ID)
 */
import mysql from 'mysql2/promise';
import { archiveVideo } from '../src/services/videos.js';
import { loadSongTitles, classifyMusicTitle } from '../src/services/videoCategory.js';

const KEY = process.env.GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const APPLY = process.argv.includes('--apply');
const CHANNEL = arg('channel');
const MATCH = (arg('match') || '').split(',').filter(Boolean);
const PAGES = Number(arg('pages', 8));
if (!CHANNEL || MATCH.length === 0) {
  console.log('사용법: node scripts/backfill-channel.mjs --channel=<@핸들|ID> --match=키워드1,키워드2 [--pages=N] [--apply]');
  process.exit(1);
}

const norm = (s) => String(s || '').normalize('NFC').toLowerCase();

const c = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

// 채널 확인
const chParam = CHANNEL.startsWith('@') ? `forHandle=${encodeURIComponent(CHANNEL)}` : `id=${CHANNEL}`;
const chRes = await (await fetch(`${API}/channels?part=snippet&${chParam}&key=${KEY}`)).json();
const ch = chRes.items?.[0];
if (!ch) { console.log('채널을 찾을 수 없음:', CHANNEL); process.exit(1); }
console.log(`채널: ${ch.snippet.title} (${ch.id}) — 키워드: ${MATCH.join(', ')}`);

// 업로드 스캔
const uploads = 'UU' + ch.id.slice(2);
const found = [];
let token = '';
for (let p = 0; p < PAGES; p++) {
  const j = await (await fetch(
    `${API}/playlistItems?part=snippet&playlistId=${uploads}&maxResults=50&key=${KEY}${token ? `&pageToken=${token}` : ''}`
  )).json();
  if (j.error) { console.log('API 오류:', j.error.message); break; }
  for (const it of j.items || []) {
    const sn = it.snippet;
    const hay = norm(`${sn.title}\n${sn.description || ''}`);
    if (MATCH.some((k) => hay.includes(norm(k)))) {
      found.push({ videoId: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt });
    }
  }
  token = j.nextPageToken || '';
  if (!token) break;
}

const songs = await loadSongTitles(c);
const [have] = await c.query('SELECT video_id FROM videos WHERE channel_id = ?', [ch.id]);
const haveSet = new Set(have.map((r) => r.video_id));
const toAdd = found.filter((v) => !haveSet.has(v.videoId) && v.publishedAt >= '2025-01-26');
console.log(`\n매칭 ${found.length}건 / 신규(5인 체제 내) ${toAdd.length}건:`);
for (const v of toAdd) {
  console.log(`   ${v.publishedAt.slice(0, 10)} [${classifyMusicTitle(v.title, songs)}] ${v.title.slice(0, 62)}`);
}

if (!APPLY) {
  console.log('\n(dry run — 실제 반영하려면 --apply)');
  await c.end();
  process.exit(0);
}

// 쇼츠 판별 + 적재
const durMap = {};
for (let i = 0; i < toAdd.length; i += 50) {
  const ids = toAdd.slice(i, i + 50).map((v) => v.videoId);
  const j = await (await fetch(`${API}/videos?part=contentDetails&id=${ids.join(',')}&key=${KEY}`)).json();
  for (const v of j.items || []) {
    const m = (v.contentDetails.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    durMap[v.id] = m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }
}
let added = 0;
for (const v of toAdd) {
  const sec = durMap[v.videoId] ?? 999;
  let shorts = false;
  if (sec <= 180) {
    try {
      const res = await fetch(`https://www.youtube.com/shorts/${v.videoId}`, { method: 'HEAD', redirect: 'manual' });
      shorts = res.status === 200 ? true : res.status >= 300 && res.status < 400 ? false : sec <= 60;
    } catch { shorts = sec <= 60; }
  }
  const ok = await archiveVideo(c, {
    videoId: v.videoId,
    channelId: ch.id,
    channelName: ch.snippet.title,
    title: v.title,
    category: classifyMusicTitle(v.title, songs),
    videoType: shorts ? 'shorts' : 'video',
    publishedAt: new Date(new Date(v.publishedAt).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
  });
  if (ok) added++;
}
console.log(`\n반영 완료 — 신규 적재 ${added}건`);
await c.end();
