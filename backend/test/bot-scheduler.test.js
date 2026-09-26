import assert from 'node:assert/strict';
import { test } from 'node:test';
import cron from 'node-cron';
import schedulerPlugin from '../src/plugins/scheduler.js';

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
  return { fastify, tasks, intervals, values, row, alerts, reject: err => reject(err), calls: () => calls, resolve: result => resolve(result), run: () => tasks[1].callback(), close: () => hooks.onClose() };
}
test('60-minute bot uses a valid hourly cron and prevents overlapping polls', async t => {
  const f = await fixture(t);
  assert.equal(f.tasks[1].expression, '0 */1 * * *');
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
  f.reject(new Error('HTTP 503')); await startup;
  const status = await f.fastify.scheduler.getStatus('youtube-1');
  assert.equal(status.consecutiveErrors, 10); assert.equal(status.status, 'stopped'); assert.equal(f.row.enabled, 0); assert.equal(f.alerts.length, 1);
  assert.match(f.alerts[0].data.rawError, /503/);
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
