/** Update both representations of the same YouTube video within the caller's transaction. */
export async function updateVideoType(connection, videoId, videoType) {
  await connection.query('UPDATE videos SET video_type = ? WHERE video_id = ?', [videoType, videoId]);
  await connection.query('UPDATE schedule_youtube SET video_type = ? WHERE video_id = ?', [videoType, videoId]);
}
