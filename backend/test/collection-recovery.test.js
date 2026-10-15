import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import mysql from 'mysql2/promise';
import plugin from '../src/services/festival/index.js';

const bot = { id: 'festival-test', searchUrl: 'https://m.dcinside.com/board/fromis?search=일정' };
const item = (title = '학교 축제 일정', extra = {}) => ({ title, date: '2026-10-01', time: '19:00', category: '행사', members: [], ...extra });
test('collection recovery in isolated MariaDB', { skip: process.env.COLLECTION_AUDIT_DB !== '1' }, async t => {
  const database = `collection_audit_${process.pid}`;
  const admin = await mysql.createConnection({ host: '127.0.0.1', user: 'root', multipleStatements: true });
  await admin.query(`CREATE DATABASE ${database}`); await admin.query(`USE ${database}`);
  for (const path of ['./fixtures/bot-schema.sql', './fixtures/collection-schema.sql', '../sql/20260926-collection-recovery.sql']) await admin.query(await readFile(new URL(path, import.meta.url), 'utf8'));
  const db = mysql.createPool({ host: '127.0.0.1', user: 'root', database, timezone: 'Z', connectionLimit: 10 });
  t.after(async () => { await db.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  await db.query("INSERT INTO schedule_categories (id,name,color) VALUES (11,'행사','#abc'),(2,'유튜브','#f00'),(10,'예능','#ccc')");
  let items, body, postNo, aiCalls, pushes, pushFailure, malformed;
  const errors = [];
  const createApp = async () => {
    const app = { db, config: { gemini: { apiKey: 'dummy' } }, log: { info() {}, warn() {}, error(e) { errors.push(e); } }, decorate(key, value) { this[key] = value; } };
    await plugin(app, { sendOpsAlert: async (db, payload) => { pushes.push(payload); if (pushFailure === 'throw') throw new Error('FCM outage'); return pushFailure ? { sent: 0, failed: 1 } : { sent: 1, failed: 0 }; } });
    return app;
  };
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('generativelanguage')) {
      aiCalls++;
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: malformed || JSON.stringify(items) }] } }] }) };
    }
    return { ok: true, text: async () => String(url).includes('?') ? `<a href="/board/fromis/${postNo}">latest</a>` : `<span class="tit">앞으로 일정</span><div class="thum-txtin">${body}</div>` };
  });
  const reset = async () => {
    await db.query('DROP TRIGGER IF EXISTS fail_queue');
    for (const table of ['bot_collection_runs','bot_pending_schedules','festival_crawl_log','schedules','bot_youtube','members','logs']) await db.query(`DELETE FROM ${table}`);
    items = [item()]; body = '10/1 학교 축제 일정 안내입니다. 프로미스나인 출연'; postNo = '100'; aiCalls = 0; pushes = []; pushFailure = false; malformed = ''; errors.length = 0;
  };
  const query = async sql => (await db.query(sql))[0];
  const run = async () => (await createApp()).festivalBot.syncNewFestivals(bot);

  await t.test('simultaneous collectors spend one AI request and queue once', async () => {
    await reset();
    const results = await Promise.all([run(), run(), run()]);
    assert.equal(aiCalls, 1); assert.equal(pushes.length, 1);
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 1);
    assert.equal(results.reduce((n, r) => n + r.addedCount, 0), 1);
    await run(); assert.equal(aiCalls, 1); assert.equal(pushes.length, 1);
  });
  await t.test('invalid AI output does not mark a post processed; later retry recovers', async () => {
    await reset(); malformed = 'not JSON';
    await assert.rejects(run(), { code: 'PARSE_FAILED' });
    assert.equal((await query('SELECT * FROM festival_crawl_log')).length, 0);
    assert.equal((await query('SELECT * FROM bot_collection_runs')).length, 0);
    malformed = ''; await run(); assert.equal(aiCalls, 2);
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 1);
  });
  await t.test('legacy error is retried but legacy successful posts keep their no-AI shortcut', async () => {
    await reset();
    await db.query("INSERT INTO festival_crawl_log (post_url,status) VALUES ('https://m.dcinside.com/board/fromis/100','error')");
    await run(); assert.equal(aiCalls, 1);
    await reset();
    await db.query("INSERT INTO festival_crawl_log (post_url,status) VALUES ('https://m.dcinside.com/board/fromis/100','processed')");
    await run(); assert.equal(aiCalls, 0);
  });
  await t.test('second-row failure rolls back the batch; new plugin resumes without AI', async () => {
    await reset(); items = [item('첫 일정'), item('실패 일정')];
    await db.query("CREATE TRIGGER fail_queue BEFORE INSERT ON bot_pending_schedules FOR EACH ROW BEGIN IF NEW.title='실패 일정' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='simulated queue failure'; END IF; END");
    await assert.rejects(run(), /simulated queue failure/);
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 0);
    assert.equal((await query('SELECT * FROM festival_crawl_log')).length, 0);
    assert.equal((await query('SELECT * FROM bot_collection_runs WHERE queued_at IS NULL')).length, 1);
    await db.query('DROP TRIGGER fail_queue'); await run();
    assert.equal(aiCalls, 1); assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 2);
    assert.equal(pushes.length, 1);
  });
  for (const failure of ['throw', 'partial']) await t.test(`notification ${failure} failure retries independently of queue/AI`, async () => {
    await reset(); pushFailure = failure;
    await assert.rejects(run());
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 1);
    assert.equal((await query('SELECT * FROM bot_collection_runs WHERE notification_pending=1')).length, 1);
    pushFailure = false; await run(); await run();
    assert.equal(aiCalls, 1); assert.equal(pushes.length, 2);
    assert.equal(pushes[0].data.eventId, pushes[1].data.eventId);
    assert.equal((await query('SELECT * FROM bot_collection_runs WHERE notification_pending=1')).length, 0);
  });
  await t.test('notification outage does not prevent new posts from reaching the queue', async () => {
    await reset(); pushFailure = 'throw'; await assert.rejects(run());
    body += ' 새 내용'; postNo = '101'; items = [item('다음 행사')];
    await assert.rejects(run()); assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 2);
  });
  await t.test('revised post updates unreviewed time; dismissed item stays dismissed', async () => {
    await reset(); await run(); body += ' 시간 수정'; items[0].time = '20:00'; await run();
    let [row] = await query('SELECT * FROM bot_pending_schedules'); assert.equal(row.time, '20:00:00');
    await db.query("UPDATE bot_pending_schedules SET status='dismissed' WHERE id=?", [row.id]);
    body += ' 재공지'; await run();
    [row] = await query('SELECT * FROM bot_pending_schedules'); assert.equal(row.status, 'dismissed');
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 1); assert.equal(pushes.length, 1);
  });
  await t.test('undated schedule receives a date without creating a second queue item', async () => {
    await reset(); items = [item('날짜 미정 행사', { date: '' })]; await run();
    const [first] = await query('SELECT id FROM bot_pending_schedules');
    body += ' 날짜 확정'; items[0].date = '2026-10-02'; await run();
    const rows = await query('SELECT id, date, stale_at FROM bot_pending_schedules');
    assert.equal(rows.length, 1); assert.equal(rows[0].id, first.id); assert.equal(rows[0].date.toISOString().slice(0,10), '2026-10-02'); assert.equal(rows[0].stale_at, null);
  });
  await t.test('AI duplicate opinion is a review hint, not authority to discard an unmatched item', async () => {
    await reset(); items = [item('새 학교 축제', { is_duplicate: true, dup_reason: '비슷한 행사' })]; await run();
    const [row] = await query('SELECT * FROM bot_pending_schedules'); assert.ok(row); assert.match(row.dup_hint, /AI 중복 의심/);
  });
  await t.test('confirmed duplicates, managed series and birthdays are excluded; one-off videos and birthday events remain', async () => {
    await reset();
    await db.query("INSERT INTO schedules (category_id,title,date) VALUES (11,'이미 있는 학교 축제','2026-10-01')");
    await db.query("INSERT INTO bot_youtube (channel_id,channel_name,auto_schedule_config) VALUES ('managed','테스트채널','{\"titleTemplate\":\"워크돌 EP.{episode}\"}')");
    await db.query("INSERT INTO members (name,birth_date,is_former) VALUES ('송하영','1997-09-29',0)");
    items = [item('이미 있는 학교 축제'), item('워크돌 EP.12',{category:'유튜브'}), item('비정기 새 웹예능',{category:'유튜브'}), item('송하영 생일',{date:'2026-09-29'}), item('송하영 생일카페',{date:'2026-09-29'})];
    await run(); const rows=await query('SELECT title FROM bot_pending_schedules ORDER BY title');
    assert.deepEqual(rows.map(r=>r.title), ['비정기 새 웹예능','송하영 생일카페']);
  });
  await t.test('stale marker clears when the source item returns and empty extraction never marks everything stale', async () => {
    await reset();
    const [{ date }] = await query("SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d') AS date");
    items = [item(undefined, { date })]; await run();
    body += ' 다른 일정'; items=[item('새 항목', { date })]; await run();
    assert.ok((await query("SELECT stale_at FROM bot_pending_schedules WHERE title='학교 축제 일정'"))[0].stale_at);
    body += ' 원래 항목 복귀'; items=[item(undefined, { date })]; await run();
    assert.equal((await query("SELECT stale_at FROM bot_pending_schedules WHERE title='학교 축제 일정'"))[0].stale_at, null);
    body += ' 빈 응답'; items=[]; await run();
    assert.equal((await query("SELECT stale_at FROM bot_pending_schedules WHERE title='학교 축제 일정'"))[0].stale_at, null);
  });
  await t.test('SIGKILL during queue transaction rolls back and a new process resumes the checkpoint', async () => {
    await reset();
    const spawn = mode => fork(new URL('./fixtures/collection-worker.js', import.meta.url), [database, mode], { env: { ...process.env, JWT_SECRET: 'isolated', COLLECTION_AUDIT_DB: '1' }, stdio: ['ignore','ignore','pipe','ipc'] });
    const first = spawn('crash'); t.after(() => first.kill());
    let errors=''; first.stderr.on('data',data=>errors+=data);
    const [message] = await once(first, 'message'); assert.equal(message.checkpoint, true, errors);
    const exit = once(first, 'exit'); first.kill('SIGKILL'); await exit;
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 0);
    assert.equal((await query('SELECT * FROM bot_collection_runs WHERE queued_at IS NULL')).length, 1);
    const second = spawn('resume'); t.after(() => second.kill());
    const finished=once(second,'exit'); const [result] = await once(second, 'message');
    assert.equal(result.done, true, JSON.stringify(result)); assert.equal(result.aiCalls, 0); await finished;
    assert.equal((await query('SELECT * FROM bot_pending_schedules')).length, 2);
    assert.equal((await query('SELECT * FROM bot_collection_runs WHERE notification_pending=1')).length, 0);
  });
});
