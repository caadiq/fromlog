import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractYoutubeVideoIds, parseTweets, fetchTweets, fetchAllTweets, resolveWrappedRetweet } from '../src/services/x/scraper.js';
const item = (id, author, text, extra = '') => `<div class="timeline-item " data-username="${author}"><a href="/${author}/status/${id}"></a><span class="tweet-date"><a title="Sep 24, 2026 · 10:00 AM UTC"></a></span><div class="tweet-content">${text}</div>${extra}</div>`;
const card = '<a class="card-container" href="https://youtube.com/watch?feature=share&amp;v=abcdefghijk"><h2 class="card-title">영상</h2></a>';
test('YouTube URLs support query order, live/embed/mobile, punctuation and deduplication', () => {
  assert.deepEqual(extractYoutubeVideoIds('https://youtu.be/abcdefghijk https://m.youtube.com/watch?feature=share&amp;v=abcdefghijk youtube.com/shorts/abcdefghij1 https://youtube.com/live/abcdefghij2 https://youtube.com/embed/abcdefghij3 (https://youtu.be/abcdefghij4).'), ['abcdefghijk', 'abcdefghij1', 'abcdefghij2', 'abcdefghij3', 'abcdefghij4']);
  assert.deepEqual(extractYoutubeVideoIds('https://notyoutube.com/watch?v=abcdefghijk https://evil.youtube.com/watch?v=abcdefghijk https://youtu.be/abcdefghijkmore'), []);
});
test('retweet author belongs to its own item; pinned and retweet policy stay intact', () => {
  const html = item('1', 'wrong', '첫 글') + item('2', 'right', '리트윗', '<div class="retweet-header"></div>') + item('3', 'pinned', '고정', '<div class="pinned"></div>');
  const rows = parseTweets(html, 'feed', { includeRetweets: true });
  assert.equal(rows.length, 2); assert.equal(rows[1].originalUsername, 'right');
  assert.equal(rows[1].url, 'https://x.com/right/status/2');
  assert.equal(parseTweets(html, 'feed').length, 1);
});
test('images, video thumbnails, card and KST source timestamp are kept separate', () => {
  const [row] = parseTweets(item('1', 'author', '본문<br>다음 줄', '<a href="/pic/orig/media%2Fphoto.jpg"></a><img src="/pic/ext_tw_video_thumb%2F123%2Fimg%2Fthumb.jpg">' + card), 'author');
  assert.deepEqual(row.imageUrls, ['https://pbs.twimg.com/media/photo.jpg']);
  assert.deepEqual(row.videoThumbnails, ['https://pbs.twimg.com/ext_tw_video_thumb/123/img/thumb.jpg']);
  assert.equal(row.card.url, 'https://youtube.com/watch?feature=share&v=abcdefghijk');
  assert.equal(row.text, '본문\n다음 줄'); assert.equal(row.time.toISOString(), '2026-09-24T10:00:00.000Z');
});
test('long tweet hydration restores card/video as well as text', async t => {
  t.mock.method(globalThis, 'fetch', async url => ({ ok: true, text: async () => String(url).includes('/status/')
    ? '<div id="m" class="main-tweet">' + item('1', 'author', '더 길고 완전한 본문입니다', '<img src="/pic/tweet_video_thumb%2Fthumb.jpg">' + card) + '<div id="r" class="replies">'
    : item('1', 'author', '더 길고…') }));
  const { tweets: [row] } = await fetchTweets('https://nitter.test', 'author');
  assert.equal(row.text, '더 길고 완전한 본문입니다'); assert.equal(row.truncated, false);
  assert.equal(row.videoThumbnails.length, 1); assert.ok(row.card);
});
test('RT wrapper resolves the body author and does not pick another notice with the same prefix', async t => {
  const body = '프로미스나인 새 방송 공지 오늘 방영합니다!';
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => item('10', 'original', body) + item('11', 'original', '프로미스나인 새 방송 공지 오늘 방영합니다! 다른 편입니다') }));
  const tweet = { id: '12', text: `RT @original: ${body}`, originalUsername: 'wrapper', time: new Date(), imageUrls: [] };
  assert.equal(await resolveWrappedRetweet('https://nitter.test', tweet), true);
  assert.equal(tweet.id, '10'); assert.equal(tweet.originalUsername, 'original'); assert.equal(tweet.text, body);
});
test('Nitter error HTML is not reported as a successful empty timeline', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => '<div class="error-panel">No authentication available</div>' }));
  await assert.rejects(fetchTweets('https://nitter.test', 'author'), /error page/);
});
test('full timeline terminates on repeated cursors instead of looping forever', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, text: async () => item('1', 'author', '본문') + '<div class="show-more"><a href="?cursor=same">More</a></div>' }; });
  await assert.rejects(fetchAllTweets('https://nitter.test', 'author'), /repeated.*cursor/);
  assert.equal(calls, 2);
});
