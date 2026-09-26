import assert from 'node:assert/strict';
import { test } from 'node:test';
import cron from 'node-cron';
import schedulerPlugin from '../src/plugins/scheduler.js';

async function fixture(t, weekly = false) {
  const tasks = [], intervals = new Map(), hooks = {}, values = new Map();
  let calls = 0, resolve;
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
    db: { query: async sql => sql === 'SELECT * FROM bot_youtube' ? [[row]] : [[]] },
    redis: { get: async key => values.get(key), set: async (key, value) => values.set(key, value) },
    youtubeBot: { syncNewVideos: async () => { calls++; return new Promise(r => { resolve = r; }); } },
    log: { info() {}, warn() {}, error() {} },
    decorate(key, value) { this[key] = value; }, addHook(key, fn) { hooks[key] = fn; },
  };
  await schedulerPlugin(fastify);
  await fastify.scheduler.startBot('youtube-1', { runImmediately: false });
  t.after(() => hooks.onClose());
  return { fastify, tasks, intervals, calls: () => calls, resolve: result => resolve(result), run: () => tasks[1].callback(), close: () => hooks.onClose() };
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
