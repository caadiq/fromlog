import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import routes from '../src/routes/admin/youtube-bots.js';
test('settings round trip carries separate filters and duration; invalid duration rejected', async t => {
  const app = Fastify(); t.after(() => app.close());
  let row;
  app.decorate('authenticate', async () => {});
  app.decorate('scheduler', { invalidateCache() {}, async startBot() {} });
  app.decorate('db', { async query(sql, p) {
    if (sql.includes('WHERE channel_id')) return [[]];
    if (sql.includes('INSERT INTO bot_youtube')) {
      row = { id: 1, channel_id: p[0], channel_handle: p[1], channel_name: p[2], banner_url: p[3], cron_interval: p[4],
        title_filters: p[5], description_filters: p[6], filter_mode: p[7], min_duration_seconds: p[8],
        exclude_shorts: p[9], archive_shorts: p[10], auto_schedule_config: p[11], weekly_schedule_config: p[12],
        video_category: p[13], add_to_schedule: p[14], enabled: 1 };
      assert.equal((sql.match(/\?/g) || []).length, p.length); return [{ insertId: 1 }];
    }
    if (sql.includes('INSERT INTO logs')) return [{}];
    if (sql.includes('WHERE id')) return [[row]];
    throw new Error(`Unexpected SQL: ${sql}`);
  } });
  app.addSchema({ $id: 'Error', type: 'object', properties: { error: { type: 'string' } } });
  await app.register(routes);
  const payload = { channel_id: 'test', channel_name: 'test', channel_handle: 'test',
    title_filters: ['방판소녀들 시즌2'], description_filters: ['하영'], filter_mode: 'split',
    min_duration_seconds: 310, exclude_shorts: true };
  const result = await app.inject({ method: 'POST', url: '/', payload });
  assert.equal(result.statusCode, 201, result.body);
  assert.equal(result.json().min_duration_seconds, 310);
  assert.deepEqual(result.json().description_filters, ['하영']);
  assert.equal(result.json().filter_mode, 'split');
  assert.equal((await app.inject({ method: 'POST', url: '/', payload: { ...payload, min_duration_seconds: -1 } })).statusCode, 400);
});
