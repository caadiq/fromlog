import { randomUUID } from 'node:crypto';
import { logActivity } from '../utils/log.js';
import { withDeadline } from '../utils/deadline.js';

// Persist one pending status alert per bot. Delivery is at least once, including after restart.
export function createOpsAlerts(db, log, send, { timeoutMs = 30000 } = {}) {
  let flushing = null;
  async function flushBatch() {
    try {
      const [rows] = await db.query('SELECT * FROM bot_ops_alerts WHERE next_attempt_at <= NOW() ORDER BY next_attempt_at LIMIT 20');
      for (const row of rows) {
        try {
          const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
          const result = await withDeadline(() => send(db, payload), timeoutMs);
          if (result?.skipped || result?.failed > 0 || !(result?.sent > 0)) throw new Error('No confirmed delivery');
          await db.query('DELETE FROM bot_ops_alerts WHERE id = ?', [row.id]);
          await logActivity(db, { actor: row.bot_id, action: 'update', category: 'bot', summary: '봇 상태 알림 발송 완료', details: { attempts: row.attempts + 1 } });
        } catch (err) {
          const delay = Math.min(3600, 60 * 2 ** Math.min(row.attempts, 6));
          await db.query('UPDATE bot_ops_alerts SET attempts = attempts + 1, next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?', [delay, row.id]);
          log.warn({ botId: row.bot_id, message: err.message }, '봇 상태 알림 재시도 대기');
        }
      }
    } catch (err) { log.error({ message: err.message }, '봇 상태 알림 대기열 처리 실패'); }
  }
  function flush() {
    if (!flushing) flushing = flushBatch().finally(() => { flushing = null; });
    return flushing;
  }
  async function enqueue(payload) {
    await db.query(`INSERT INTO bot_ops_alerts (id, bot_id, payload) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE id = VALUES(id), payload = VALUES(payload), attempts = 0, next_attempt_at = NOW(), created_at = NOW()`,
    [randomUUID(), payload.data.botId, JSON.stringify(payload)]);
    void flush();
    return { queued: true };
  }
  const cancel = botId => db.query('DELETE FROM bot_ops_alerts WHERE bot_id = ?', [botId]);
  return { enqueue, flush, cancel };
}
