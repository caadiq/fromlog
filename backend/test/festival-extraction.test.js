import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractScheduleItems } from '../src/services/festival/gemini.js';
import { fetchLatestSchedulePost } from '../src/services/festival/scraper.js';
import { queueKey, validateScheduleItems } from '../src/services/festival/items.js';
const item = { title: '일정', date: '2026-09-30', time: '19:30', category: '행사', members: ['지원'], is_duplicate: false };
const listUrl = 'https://m.dcinside.com/board/fromis?search=일정';

test('extraction validates dates, time, boolean and field types before any queue write', async t => {
  let reply;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: reply }] } }] }) }));
  reply = '```json\n' + JSON.stringify([item]) + '\n```';
  assert.equal((await extractScheduleItems('본문', [], 'dummy', 2026))[0].time, '19:30');
  for (const extra of [{ date: '2026-02-30' }, { time: '24:10' }, { title: {} }, { is_duplicate: 'false' }, { members: '지원' }, { category: 'unknown' }]) {
    reply = JSON.stringify([{ ...item, ...extra }]);
    await assert.rejects(extractScheduleItems('본문', [], 'dummy', 2026), { code: 'PARSE_FAILED' });
  }
  assert.equal(validateScheduleItems([{ ...item, date: '', time: '' }])[0].date, '');
  assert.ok(queueKey({ ...item, title: '긴제목'.repeat(160) }).length <= 255);
  assert.equal(queueKey(item), queueKey({ ...item, title: item.title.normalize('NFD') }));
});
test('truncated Gemini output is retryable even when its JSON happens to be valid', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '[]' }] } }] }) }));
  await assert.rejects(extractScheduleItems('본문', [], 'dummy', 2026), { code: 'PARSE_FAILED' });
});
test('Gemini timeout covers the response body, not just HTTP headers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => ({ ok: true, json: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) }));
  const promise = extractScheduleItems('본문', [], 'dummy', 2026);
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(120000);
  await assert.rejects(promise, /타임아웃/);
});
test('latest DC post belongs to the requested gallery and nested body is complete', async t => {
  t.mock.method(globalThis, 'fetch', async url => ({ ok: true, text: async () => url === listUrl
    ? '<a href="/board/other/999">other</a><a href="/board/fromis/10">older</a><a href="/board/fromis/11">new</a>'
    : '<span class="tit">배경색</span><span class="title_subject">앞으로 일정 스케줄</span><div class="thum-txtin"><div><div>9/30 학교 일정 첫 번째</div></div><p>10/1 다음 일정 두 번째</p></div><div>댓글 제외</div>' }));
  const post = await fetchLatestSchedulePost(listUrl);
  assert.equal(post.title, '앞으로 일정 스케줄'); assert.equal(post.postNo, '11'); assert.match(post.body, /두 번째/); assert.doesNotMatch(post.body, /댓글/);
});
test('DC block pages and missing bodies fail instead of being sent to Gemini', async t => {
  let listing = false;
  t.mock.method(globalThis, 'fetch', async url => ({ ok: true, text: async () => listing && url === listUrl ? '<a href="/board/fromis/11">new</a>' : '<html>Access denied. Please try again later.</html>' }));
  await assert.rejects(fetchLatestSchedulePost(listUrl), /목록/);
  listing = true; await assert.rejects(fetchLatestSchedulePost(listUrl), /본문/);
});
test('DC timeout also covers stalled body reads', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => ({ ok: true, text: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) }));
  const promise = fetchLatestSchedulePost(listUrl);
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(15000); await assert.rejects(promise, /타임아웃/);
});

test('mobile DC metadata supplies the title when the desktop subject span is absent', async t => {
  t.mock.method(globalThis, 'fetch', async url => ({ ok: true, text: async () => url === listUrl
    ? '<a href="/board/fromis/11">new</a>'
    : '<meta property="og:title" content="앞으로 일정 스케줄 - 갤러리"><span class="tit">배경색</span><div class="thum-txtin">9/30 학교 일정 첫 번째 10/1 다음 일정 두 번째</div>' }));
  const post = await fetchLatestSchedulePost(listUrl);
  assert.equal(post.title, '앞으로 일정 스케줄 - 갤러리');
});
