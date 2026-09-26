import { formatDateTime } from './date.js';
import { withTransaction } from './transaction.js';

// SQL values are KST wall times; API values are UTC instants.
export function hasLaterPublication(upload, archived) {
  return Boolean(archived?.publication_time && upload.publishedAt &&
    Number.isFinite(new Date(upload.publishedAt).getTime()) &&
    formatDateTime(upload.publishedAt) > archived.publication_time);
}

export async function correctYoutubePublication(db, video) {
  if (!video?.publishedAt || !Number.isFinite(new Date(video.publishedAt).getTime())) return null;
  const published = formatDateTime(video.publishedAt);
  return withTransaction(db, async conn => {
    const [rows] = await conn.query(
      "SELECT DATE_FORMAT(published_at, '%Y-%m-%d %H:%i:%s') AS publication_time FROM videos WHERE video_id = ? FOR UPDATE", [video.videoId]);
    const old = rows[0]?.publication_time;
    if (!old || published <= old) return null;
    // Only move schedules still using the old imported timestamp. Preserve manual edits.
    const [schedules] = await conn.query(
      `SELECT s.id FROM schedules s JOIN schedule_youtube sy ON sy.schedule_id = s.id
       WHERE sy.video_id = ? AND s.is_temp = 0 AND s.date = ? AND s.time = ? FOR UPDATE`,
      [video.videoId, old.slice(0, 10), old.slice(11)]);
    for (const { id } of schedules) {
      await conn.query('UPDATE schedules SET date = ?, time = ? WHERE id = ?', [published.slice(0, 10), published.slice(11), id]);
    }
    await conn.query('UPDATE videos SET published_at = ? WHERE video_id = ?', [published, video.videoId]);
    await conn.query('UPDATE youtube_bot_processed SET video_date = ? WHERE video_id = ?', [published.slice(0, 10), video.videoId]);
    return { before: old, after: published, scheduleIds: schedules.map(s => s.id) };
  });
}
