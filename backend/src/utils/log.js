/**
 * 활동 로그 유틸리티
 * fire-and-forget: 로그 실패가 비즈니스 로직에 영향 주지 않도록 처리
 */

/**
 * @param {object} db - DB 커넥션
 * @param {object} params
 * @param {string} params.actor - 행위자 ("admin", "youtube-3", "x-1" 등)
 * @param {string} params.action - 행동 (create, update, delete, upload, start, stop, sync_complete, error)
 * @param {string} params.category - 대분류 (album, schedule, member, bot, category, dict, concert, sync)
 * @param {string} [params.targetType] - 대상 타입 (youtube_schedule, x_schedule, album, photo, member 등)
 * @param {number} [params.targetId] - 대상 DB ID
 * @param {string} params.summary - 한 줄 요약
 * @param {object} [params.details] - 추가 상세 정보 (JSON)
 */
export async function logActivity(db, { actor, action, category, targetType, targetId, summary, details }) {
  try {
    await db.query(
      'INSERT INTO logs (actor, action, category, target_type, target_id, summary, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [actor, action, category, targetType || null, targetId || null, summary, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // 로그 실패는 무시 — 비즈니스 로직에 영향 주지 않음
  }
}
