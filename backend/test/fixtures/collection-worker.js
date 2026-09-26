import mysql from 'mysql2/promise';
import plugin from '../../src/services/festival/index.js';
if (process.env.COLLECTION_AUDIT_DB !== '1' || !/^collection_audit_\d+$/.test(process.argv[2] || '')) throw new Error('Isolated test DB required');
const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', database: process.argv[2], timezone: 'Z', connectionLimit: 8 });
let inserts = 0, aiCalls = 0;
const getConnection = pool.getConnection.bind(pool);
pool.getConnection = async () => {
  const conn = await getConnection();
  const query = conn.query.bind(conn);
  conn.query = async (sql, values) => {
    if (process.argv[3] === 'crash' && sql.includes('INSERT INTO bot_pending_schedules') && ++inserts === 2) {
      process.send({ checkpoint: true });
      await new Promise(() => { setInterval(() => {}, 1000); });
    }
    return query(sql, values);
  };
  return conn;
};
globalThis.fetch = async url => {
  if (String(url).includes('generativelanguage')) {
    aiCalls++;
    if (process.argv[3] !== 'crash') throw new Error('Recovery must use the durable extraction');
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([
      { title: '복구 일정 A', date: '2026-10-01', category: '행사' }, { title: '복구 일정 B', date: '2026-10-02', category: '행사' },
    ]) }] } }] }) };
  }
  return { ok: true, text: async () => String(url).includes('?') ? '<a href="/board/fromis/100">post</a>' : '<div class="thum-txtin">10/1 복구 일정 A<br>10/2 복구 일정 B 안내</div>' };
};
const app = { db: pool, config: { gemini: { apiKey: 'dummy' } }, log: { info() {}, warn() {}, error() {} }, decorate(key, value) { this[key] = value; } };
await plugin(app, { sendOpsAlert: async () => ({ sent: 1, failed: 0 }) });
try {
  const result = await app.festivalBot.syncNewFestivals({ id: 'festival-test', searchUrl: 'https://m.dcinside.com/board/fromis?search=일정' });
  await pool.end(); process.send({ done: true, aiCalls, result }); process.disconnect();
} catch (err) { await pool.end(); process.send({ error: err.message }); process.exitCode = 1; process.disconnect(); }
