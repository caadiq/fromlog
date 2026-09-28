import assert from 'node:assert/strict';
import { test } from 'node:test';
import cron from 'node-cron';
import schedulerPlugin, { describeBotError, isTransientBotError, recoveryDelayMs } from '../src/plugins/scheduler.js';

async function fixture(t, weekly = false) {
  const tasks = [], intervals = new Map(), hooks = {}, values = new Map();
  let calls = 0, resolve, reject;
  const alerts = [];
  const row = { id: 1, channel_id: 'channel', channel_name: 'Test', enabled: 1, cron_interval: 60,
    weekly_schedule_config: weekly ? JSON.stringify({ dayOfWeek: 4, startTime: '19:00', intervalSeconds: 30, durationMinutes: 1 }) : null };
  t.mock.method(cron, 'schedule', (expression, callback) => {
    assert.equal(cron.validate(expression), true, expression);
    const task = { expression, callback, stopped: false, stop() { this.stopped = true; } };
    tasks.push(task); return task;
  });
  t.mock.method(globalThis, 'setInterval', callback => { const key = {}; intervals.set(key, callback); return key; });
  t.mock.method(globalThis, 'clearInterval', key => intervals.delete(key));
  const fastify = {
    db: { query: async (sql, params) => { if (sql === 'SELECT * FROM bot_youtube') return [[row]]; if (sql.startsWith('UPDATE bot_youtube')) row.enabled = params[0]; return [[]]; } },
    redis: { get: async key => values.get(key), set: async (key, value) => values.set(key, value) },
    youtubeBot: { syncNewVideos: async () => { calls++; return new Promise((r, j) => { resolve = r; reject = j; }); } },
    log: { info() {}, warn() {}, error() {} },
    decorate(key, value) { this[key] = value; }, addHook(key, fn) { hooks[key] = fn; },
  };
  await schedulerPlugin(fastify, { sendOpsAlert: async (db, payload) => { alerts.push(payload); return { sent: 1, failed: 0 }; } });
  await fastify.scheduler.startBot('youtube-1', { runImmediately: false });
  t.after(() => hooks.onClose());
  return { fastify, tasks, intervals, values, row, alerts, reject: err => reject(err), calls: () => calls, resolve: result => resolve(result), sweep: () => tasks[1].callback(), run: () => tasks.filter(task => !task.stopped && task.expression !== '* * * * *' && task.expression !== '5 0 * * *').at(-1).callback(), close: () => hooks.onClose() };
}
test('60-minute bot uses a valid hourly cron and prevents overlapping polls', async t => {
  const f = await fixture(t);
  assert.equal(f.tasks[2].expression, '0 */1 * * *');
  const first = f.run();
  await f.run();
  assert.equal(f.calls(), 1);
  f.resolve({ addedCount: 0 }); await first;
  const next = f.run(); assert.equal(f.calls(), 2);
  f.resolve({ addedCount: 0 }); await next;
  await f.close(); assert.ok(f.tasks.every(task => task.stopped));
});
test('weekly polling stays single-flight and ends immediately when the full episode is found', async t => {
  const f = await fixture(t, true);
  const first = f.run();
  assert.equal(f.intervals.size, 1);
  await [...f.intervals.values()][0]();
  assert.equal(f.calls(), 1);
  f.resolve({ addedCount: 0, foundTarget: true }); await first;
  assert.equal(f.intervals.size, 0);
});
test('expired burst does not issue another request; stopAll clears burst timers', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const f = await fixture(t, true);
  let run = f.run(); f.resolve({ addedCount: 0, foundTarget: false }); await run;
  t.mock.timers.setTime(1060001);
  await [...f.intervals.values()][0]();
  assert.equal(f.calls(), 1); assert.equal(f.intervals.size, 0);
  run = f.run(); f.resolve({ addedCount: 0 }); await run;
  assert.equal(f.intervals.size, 1);
  await f.fastify.scheduler.stopAll(); assert.equal(f.intervals.size, 0);
});


for (const failure of [false, true]) test(`in-flight completion after stop cannot reactivate status; failure=${failure}`, async t => {
  const f = await fixture(t);
  const running = f.run();
  await f.fastify.scheduler.stopBot('youtube-1');
  if (failure) f.reject(new Error('late failure')); else f.resolve({ addedCount: 1 });
  await running;
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.status, 'stopped'); assert.equal(f.row.enabled, 0); assert.equal(f.alerts.length, 0);
});
test('startup preserves error history, stops at the threshold, then manual restart recovers', async t => {
  const f = await fixture(t);
  await f.fastify.scheduler.stopAll();
  f.values.set('bot:status:youtube-1', JSON.stringify({ status: 'error', consecutiveErrors: 9, totalAdded: 0 }));
  const startup = f.fastify.scheduler.startAll();
  while (!f.calls()) await new Promise(setImmediate);
  f.reject(new Error('HTTP 403')); await startup;
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.consecutiveErrors, 10); assert.equal(status.status, 'stopped'); assert.equal(f.row.enabled, 0); assert.equal(f.alerts.length, 1);
  assert.match(f.alerts[0].data.rawError, /403/);
  await f.fastify.scheduler.startBot('youtube-1', { runImmediately: false });
  assert.equal((await f.fastify.scheduler.getStatus('youtube-1')).consecutiveErrors, 0);
});
test('restart inside weekly window resumes only the remaining scheduled time', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-24T10:00:30Z') });
  const f = await fixture(t, true); await f.fastify.scheduler.stopAll();
  const startup = f.fastify.scheduler.startAll();
  while (!f.calls()) await new Promise(setImmediate);
  f.resolve({ addedCount: 0, foundTarget: false }); await startup;
  assert.equal(f.intervals.size, 1);
  t.mock.timers.setTime(new Date('2026-09-24T10:01:00Z').valueOf());
  await [...f.intervals.values()][0]();
  assert.equal(f.calls(), 1); assert.equal(f.intervals.size, 0);
});
test('restart outside weekly window waits for the next scheduled run', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-24T10:02:00Z') });
  const f = await fixture(t, true); await f.fastify.scheduler.stopAll();
  await f.fastify.scheduler.startAll(); assert.equal(f.calls(), 0); assert.equal(f.intervals.size, 0);
});
test('zero-addition recovery clears the error and previous addition count', async t => {
  const f = await fixture(t); let running = f.run();
  f.resolve({ addedCount: 3 }); await running;
  running = f.run(); f.reject(new Error('temporary outage')); await running;
  running = f.run(); f.resolve({ addedCount: 0 }); await running;
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.status, 'running'); assert.equal(status.errorMessage, null);
  assert.equal(status.lastAddedCount, 0); assert.equal(status.totalAdded, 3); assert.equal(status.consecutiveErrors, 0);
  assert.equal(typeof status.lastSyncDuration, 'number');
});

test('restart after midnight resumes the previous day weekly window', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-24T15:05:00Z') });
  const f = await fixture(t, true); await f.fastify.scheduler.stopAll();
  f.row.weekly_schedule_config = JSON.stringify({ dayOfWeek: 4, startTime: '23:50', intervalSeconds: 30, durationMinutes: 30 });
  const startup = f.fastify.scheduler.startAll();
  while (!f.calls()) await new Promise(setImmediate);
  f.resolve({ addedCount: 0 }); await startup;
  assert.equal(f.intervals.size, 1);
  t.mock.timers.setTime(new Date('2026-09-24T15:20:00Z').valueOf());
  await [...f.intervals.values()][0]();
  assert.equal(f.calls(), 1); assert.equal(f.intervals.size, 0);
});

test('successful startup clears the preserved error message', async t => {
  const f = await fixture(t); await f.fastify.scheduler.stopAll();
  f.values.set('bot:status:youtube-1', JSON.stringify({ status: 'error', consecutiveErrors: 2, errorMessage: 'previous failure' }));
  const startup = f.fastify.scheduler.startAll();
  while (!f.calls()) await new Promise(setImmediate);
  f.resolve({ addedCount: 0 }); await startup;
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.errorMessage, null); assert.equal(status.consecutiveErrors, 0);
});


test('Redis outage preserves successful sync, restores local status, and stops all timers', async t => {
 const f=await fixture(t);const originalGet=f.fastify.redis.get,originalSet=f.fastify.redis.set;
 f.fastify.redis.get=async()=>{throw Error('Redis down');};f.fastify.redis.set=async()=>{throw Error('Redis down');};
 const work=f.run();f.resolve({addedCount:2});await work;let status=await f.fastify.scheduler.getStatus('youtube-1');assert.equal(status.consecutiveErrors,0);assert.equal(status.totalAdded,2);
 await f.fastify.scheduler.stopAll();assert.ok(f.tasks.slice(2).every(x=>x.stopped));
 f.fastify.redis.get=originalGet;f.fastify.redis.set=originalSet;status=await f.fastify.scheduler.getStatus('youtube-1');assert.equal(status.status,'stopped');assert.equal(JSON.parse(f.values.get('bot:status:youtube-1')).totalAdded,2);
});
test('malformed Redis state does not prevent stop or next run', async t=>{
 const f=await fixture(t);f.values.set('bot:status:youtube-1','broken');const work=f.run();f.resolve({addedCount:1});await work;assert.equal((await f.fastify.scheduler.getStatus('youtube-1')).totalAdded,1);await f.fastify.scheduler.stopBot('youtube-1');assert.equal(f.row.enabled,0);
});

test('quota and key diagnostics name the correct upstream',()=>{
 assert.equal(describeBotError({type:'festival'},Error('quotaExceeded')).reason,'Gemini API 할당량 초과');
 assert.equal(describeBotError({type:'youtube'},Error('quotaExceeded')).reason,'YouTube API 할당량 초과');
 assert.match(describeBotError({type:'festival'},Error('API key not valid')).action,/GEMINI/);
});


test('network failures keep ownership enabled, back off past ten errors, then recover once', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const f = await fixture(t);
  for (let attempt = 1; attempt <= 12; attempt++) {
    const running = f.run(); f.reject(new Error('fetch failed', { cause: Object.assign(new Error('DNS'), { code: 'EAI_AGAIN' }) })); await running;
    const status = await f.fastify.scheduler.getStatus('youtube-1');
    assert.equal(status.status, 'recovering'); assert.equal(f.row.enabled, 1);
    assert.equal(Date.parse(status.nextRetryAt) - Date.now(), recoveryDelayMs(attempt));
    await f.run(); await f.sweep(); assert.equal(f.calls(), attempt);
    t.mock.timers.setTime(Date.parse(status.nextRetryAt));
  }
  assert.equal(f.alerts.length, 1);
  const retry = f.sweep(); while (f.calls() < 13) await new Promise(setImmediate);
  await f.run(); assert.equal(f.calls(), 13);
  f.resolve({ addedCount: 0 }); await retry;
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.status, 'running'); assert.equal(status.nextRetryAt, null); assert.equal(status.consecutiveErrors, 0);
  assert.deepEqual(f.alerts.map(a => a.data.kind), ['bot_recovering', 'bot_recovered']);
});

test('manual stop cancels recovery and restart never re-enables disabled bots', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const f = await fixture(t); const running = f.run(); f.reject(new Error('HTTP 502')); await running;
  await f.fastify.scheduler.stopBot('youtube-1');
  t.mock.timers.setTime(9000000); await f.sweep(); await f.fastify.scheduler.startAll(); await f.sweep();
  assert.equal(f.calls(), 1); assert.equal(f.row.enabled, 0);
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.status, 'stopped'); assert.equal(status.nextRetryAt, null);
});

test('restart retains backoff; weekly recovery runs even after the polling window', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-24T10:00:30Z') });
  const f = await fixture(t, true); const running = f.run(); f.reject(new Error('request timeout')); await running;
  const before = await f.fastify.scheduler.getStatus('youtube-1');
  await f.fastify.scheduler.stopAll(); await f.fastify.scheduler.startAll();
  assert.equal(f.calls(), 1);
  assert.equal((await f.fastify.scheduler.getStatus('youtube-1')).nextRetryAt, before.nextRetryAt);
  t.mock.timers.setTime(Date.parse(before.nextRetryAt));
  const retry = f.sweep(); while (f.calls() < 2) await new Promise(setImmediate);
  f.resolve({ addedCount: 1, foundTarget: true }); await retry;
  assert.equal((await f.fastify.scheduler.getStatus('youtube-1')).status, 'running'); assert.equal(f.alerts.length, 2);
});

test('temporary failures are distinguished from credentials and configuration', () => {
  for (const message of ['HTTP 502', 'HTTP 503', 'HTTP 429', '요청 타임아웃', 'fetch failed', 'EAI_AGAIN']) assert.equal(isTransientBotError(Error(message)), true, message);
  for (const message of ['HTTP 403', 'HTTP 401', 'HTTP 404', 'quotaExceeded', 'API key not valid', 'fetch failed certificate expired', 'session expired']) assert.equal(isTransientBotError(Error(message)), false, message);
  assert.doesNotMatch(describeBotError({ type: 'x' }, Error('timeout')).reason, /세션 만료/);
});

for (const failure of [false, true]) test(`manual stop during recovery cannot reactivate or rearm retry; failure=${failure}`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const f = await fixture(t); const initial = f.run(); f.reject(Error('HTTP 502')); await initial;
  t.mock.timers.setTime(1060000);
  const retry = f.sweep(); while (f.calls() < 2) await new Promise(setImmediate);
  await f.fastify.scheduler.stopBot('youtube-1');
  if (failure) f.reject(Error('HTTP 502')); else f.resolve({ addedCount: 1 });
  await retry; t.mock.timers.setTime(9000000); await f.sweep();
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.status, 'stopped'); assert.equal(status.nextRetryAt, null);
  assert.equal(f.calls(), 2); assert.equal(f.row.enabled, 0); assert.equal(f.alerts.length, 1);
});

test('admin bot API exposes recovery status and retry deadline', async () => {
  const { default: Fastify } = await import('fastify');
  const { default: routes } = await import('../src/routes/admin/bots.js');
  const app = Fastify();
  app.decorate('db', {}); app.decorate('redis', {}); app.decorate('authenticate', async () => {});
  app.decorate('scheduler', {
    getBots: async () => [{ id: 'youtube-1', type: 'youtube', enabled: true, cron: '*/1 * * * *' }],
    getStatus: async () => ({ status: 'recovering', nextRetryAt: '2026-09-28T05:30:00.000Z', consecutiveErrors: 12 }),
  });
  try {
    await app.register(routes, { prefix: '/bots' });
    const res = await app.inject('/bots/'); assert.equal(res.statusCode, 200);
    assert.equal(res.json()[0].status, 'recovering'); assert.equal(res.json()[0].enabled, true);
    assert.equal(res.json()[0].next_retry_at, '2026-09-28T05:30:00.000Z');
  } finally { await app.close(); }
});
