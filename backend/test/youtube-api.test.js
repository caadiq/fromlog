import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVideoDurations, fetchVideoInfo, fetchAllVideos, fetchShortsLinkedVideo } from '../src/services/youtube/api.js';

test('API quota errors propagate instead of pretending videos are missing', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'quotaExceeded' } }) }));
  await assert.rejects(getVideoDurations(['abcdefghijk']), /quotaExceeded/);
  await assert.rejects(fetchVideoInfo('abcdefghijk'), /quotaExceeded/);
});
test('unknown Shorts classification stays retryable and long videos skip HEAD', async t => {
  let heads = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('/shorts/')) { heads++; return { status: 429 }; }
    return { json: async () => ({ items: [{ id: 'short', contentDetails: { duration: 'PT30S' } }, { id: 'long', contentDetails: { duration: 'PT20M' } }] }) };
  });
  const result = await getVideoDurations(['short', 'long']);
  assert.equal(result.short.isShorts, null); assert.equal(result.long.isShorts, false); assert.equal(heads, 1);
});
test('full sync uses video publication time, correct type and playlist pagination', async t => {
  let pages = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    const u = new URL(input);
    if (u.pathname.endsWith('/playlistItems')) {
      pages++;
      assert.ok(u.searchParams.get('part').includes('contentDetails'));
      if (pages === 2) { assert.equal(u.searchParams.get('pageToken'), 'second'); return { json: async () => ({ items: [] }) }; }
      return { json: async () => ({ nextPageToken: 'second', items: [{ snippet: { title: 'Video', channelId: 'channel', publishedAt: '2026-09-01T00:00:00Z', resourceId: { videoId: 'abcdefghijk' } }, contentDetails: { videoPublishedAt: '2026-09-25T12:00:00Z' } }] }) };
    }
    return { json: async () => ({ items: [{ id: 'abcdefghijk', contentDetails: { duration: 'PT20M' } }] }) };
  });
  const [video] = await fetchAllVideos('channel', 'uploads');
  assert.equal(video.videoType, 'video'); assert.equal(video.duration, 1200); assert.equal(video.date, '2026-09-25'); assert.equal(video.time, '21:00:00'); assert.equal(pages, 2);
});

test('related-video network failures remain retryable rather than title exclusions', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ status: 429 }));
  await assert.rejects(fetchShortsLinkedVideo('abcdefghijk'), /HTTP 429/);
});
