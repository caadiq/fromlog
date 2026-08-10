/**
 * 기존 '음방' 영상 재분류 (1회성)
 *
 * 음방 채널에서 수집한 영상을 채널만 보고 전부 music으로 넣었던 탓에
 * 그 채널들의 자체 예능·라디오·챌린지까지 음방에 섞였다.
 * videoCategory 규칙으로 다시 판별해 무대가 아닌 것을 variety로 옮긴다.
 *
 * 사용법: node scripts/reclassify-music.mjs [--apply]
 *         (--apply 없으면 변경 없이 결과만 출력)
 */
import mysql from 'mysql2/promise';
import { loadSongTitles, classifyMusicTitle } from '../src/services/videoCategory.js';

const APPLY = process.argv.includes('--apply');

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const songs = await loadSongTitles(c);
const [rows] = await c.query(
  "SELECT video_id, title, channel_name FROM videos WHERE category = 'music'"
);

const moved = rows.filter((r) => classifyMusicTitle(r.title, songs) === 'variety');

const byChannel = {};
for (const r of moved) byChannel[r.channel_name] = (byChannel[r.channel_name] || 0) + 1;

console.log(`음방 ${rows.length}건 중 ${moved.length}건이 예능·기타로 이동 대상`);
for (const [ch, n] of Object.entries(byChannel)) console.log(`  ${ch}: ${n}건`);

if (!APPLY) {
  console.log('\n(dry run — 실제 반영하려면 --apply)');
} else if (moved.length > 0) {
  const ids = moved.map((r) => r.video_id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await c.query(
      `UPDATE videos SET category = 'variety', members = NULL
       WHERE video_id IN (${chunk.map(() => '?').join(',')})`,
      chunk
    );
  }
  const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM videos WHERE category = 'music'");
  console.log(`\n반영 완료 — 음방 ${n}건 남음`);
}

await c.end();
