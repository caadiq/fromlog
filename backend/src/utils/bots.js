/**
 * 봇 공용 헬퍼
 */

/**
 * 관리 중인(활성) YouTube 채널 ID 목록.
 * X 봇이 "관리 채널 영상은 트윗에서 중복 수집하지 않기" 판정에 쓴다.
 */
export async function getManagedChannelIds(db) {
  const [rows] = await db.query('SELECT channel_id FROM bot_youtube WHERE enabled = 1');
  return rows.map((r) => r.channel_id);
}
