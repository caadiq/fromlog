// One-time, idempotent repair; defaults to preview. Run with --apply after the SQL migration.
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { MeiliSearch } from 'meilisearch';
import Redis from 'ioredis';
import config from '../src/config/index.js';
import youtubePlugin from '../src/services/youtube/index.js';
import { fetchVideoInfo } from '../src/services/youtube/api.js';
import { matchesVideoFilters, meetsDuration, extractEpisode } from '../src/utils/youtubePolicy.js';
import { withYoutubeChannelLock } from '../src/utils/youtubeLock.js';
import { syncScheduleById } from '../src/services/meilisearch/index.js';
import { logActivity } from '../src/utils/log.js';
const apply = process.argv.includes('--apply');
const channelId = 'UCEuVdpLKSyjQLFRT1kWd_4A';
const db = mysql.createPool(config.db);
const meilisearch = new MeiliSearch({ host: config.meilisearch.host, apiKey: config.meilisearch.apiKey });
const redis = new Redis({ host: config.redis.host, port: config.redis.port });
try {
  const [rows] = await db.query('SELECT * FROM bot_youtube WHERE id = 7 AND channel_id = ?', [channelId]);
  if (!rows.length) throw new Error('Expected channel configuration is missing');
  const before = rows[0];
  const auto = { ...JSON.parse(before.auto_schedule_config), titleTemplate: '방판소녀들 시즌2 EP.{episode}', episodeMatch: '방판소녀들 시즌2' };
  delete auto.episodeOffset;
  const bot = { id: 'youtube-7', channelId, channelName: before.channel_name, titleFilters: ['방판소녀들 시즌2'],
    descriptionFilters: [], filterMode: 'split', minDurationSeconds: 300, excludeShorts: true, archiveShorts: true,
    addToSchedule: true, videoCategory: before.video_category, autoScheduleNext: auto };
  const main = await fetchVideoInfo('Am4EJN0uF3Q');
  const preview = await fetchVideoInfo('oOxKGf2XPjE');
  if (!main || main.channelId !== channelId || extractEpisode(main.title) !== 2 || !matchesVideoFilters(bot, main) || meetsDuration(bot, main) !== true) throw new Error('Main episode validation failed');
  if (!preview || meetsDuration(bot, preview) !== false) throw new Error('Preview validation failed');
  const [schedules] = await db.query('SELECT s.*, sy.video_id FROM schedules s JOIN schedule_youtube sy ON sy.schedule_id=s.id WHERE sy.channel_id=? AND s.date >= ?', [channelId, '2026-09-17']);
  console.log(JSON.stringify({ apply, main: { id: main.videoId, title: main.title, duration: main.duration }, schedules, nextTemplate: auto.titleTemplate }));
  if (apply) {
    fs.mkdirSync('backups', { recursive: true });
    fs.writeFileSync(`backups/bangpan-before-${Date.now()}.json`, JSON.stringify({ bot: before, schedules }, null, 2), { mode: 0o600 });
    await withYoutubeChannelLock(db, channelId, async () => {
      await db.query("UPDATE bot_youtube SET title_filters=?, description_filters='[]', filter_mode='split', min_duration_seconds=300, auto_schedule_config=? WHERE id=7", [JSON.stringify(bot.titleFilters), JSON.stringify(auto)]);
      await db.query('DELETE FROM youtube_skipped_videos WHERE channel_id=?', [channelId]);
      await db.query('DELETE FROM youtube_bot_processed WHERE channel_id=?', [channelId]);
      await logActivity(db, { actor: 'admin', action: 'update', category: 'bot', targetType: 'youtube_bot', targetId: 7,
        summary: '방판소녀들 제목 전용 필터·최소 5분·실제 회차 계산 적용', details: { previous: before.auto_schedule_config, auto } });
    });
    const app = { db, redis, meilisearch, log: console, decorate(key, value) { this[key] = value; } };
    await youtubePlugin(app);
    console.log('sync', await app.youtubeBot.syncNewVideos(bot));
    await withYoutubeChannelLock(db, channelId, async () => {
      const title = await app.youtubeBot.generateScheduledTitle(bot);
      if (title !== '방판소녀들 시즌2 EP.3') throw new Error(`Unexpected next episode: ${title}`);
      const [pending] = await db.query('SELECT s.id,s.title FROM schedules s JOIN schedule_youtube sy ON sy.schedule_id=s.id WHERE sy.channel_id=? AND s.is_temp=1 AND s.date=?', [channelId, '2026-09-24']);
      if (pending.length !== 1) throw new Error('Expected one upcoming schedule');
      await db.query('UPDATE schedules SET title=? WHERE id=? AND is_temp=1', [title, pending[0].id]);
      await syncScheduleById(meilisearch, db, pending[0].id, redis);
      await logActivity(db, { actor: 'admin', action: 'update', category: 'schedule', targetType: 'youtube_schedule', targetId: pending[0].id,
        summary: `방판소녀들 예정 회차 보정: ${pending[0].title} → ${title}` });
    });
    const [after] = await db.query('SELECT s.id,s.title,s.date,s.time,s.is_temp,sy.video_id,v.duration FROM schedules s JOIN schedule_youtube sy ON sy.schedule_id=s.id LEFT JOIN videos v ON v.video_id=sy.video_id WHERE sy.channel_id=? AND s.date >= ? ORDER BY s.date,s.time', [channelId, '2026-09-17']);
    console.log('after', JSON.stringify(after));
  }
} finally { await db.end(); await redis.quit(); }
