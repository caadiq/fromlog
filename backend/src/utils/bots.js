/**
 * 봇 공용 헬퍼
 */

/**
 * 관리 중인(활성) YouTube 채널 ID 목록.
 * X ingestion leaves managed-channel pending schedules for the channel bot to reconcile.
 */
export async function getManagedChannelIds(db) {
  const [rows] = await db.query('SELECT channel_id FROM bot_youtube WHERE enabled = 1');
  return rows.map((r) => r.channel_id);
}
