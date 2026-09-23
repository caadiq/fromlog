import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesVideoFilters, meetsDuration, extractEpisode, nextEpisodeTitle } from '../src/utils/youtubePolicy.js';
test('split filters use their own field, OR within and AND across fields; legacy remains unchanged', () => {
  const video = { title: '프로그램 EP.2', description: '송하영 출연' };
  assert.equal(matchesVideoFilters({ titleFilters: ['송하영'] }, video), false);
  assert.equal(matchesVideoFilters({ filterMode: 'legacy', titleFilters: ['송하영'] }, video), true);
  assert.equal(matchesVideoFilters({ titleFilters: ['다른', '프로그램'], descriptionFilters: ['송하영'] }, video), true);
  assert.equal(matchesVideoFilters({ titleFilters: ['프로그램'], descriptionFilters: ['박지원'] }, video), false);
  assert.equal(matchesVideoFilters({ descriptionFilters: ['송하영'] }, video), true);
  assert.equal(matchesVideoFilters({ titleFilters: ['프로그램'.normalize('NFD')] }, video), true);
});
test('duration boundary, unknown metadata and shorts', () => {
  const bot = { minDurationSeconds: 300 };
  for (const [duration, expected] of [[299,false],[300,true],[301,true],[0,null],[undefined,null]]) {
    assert.equal(meetsDuration(bot, { videoType: 'video', duration }), expected);
  }
  assert.equal(meetsDuration(bot, { videoType: 'shorts', duration: 25 }), true);
  assert.equal(meetsDuration({}, { videoType: 'video' }), true);
});
test('episode variants and ambiguous/unlabelled numbers', () => {
  for (const title of ['EP.1', 'EP1', 'EP. 01', 'Episode 1', '1화', '제1화', '1회']) assert.equal(extractEpisode(title), 1, title);
  for (const title of ['시즌2 9월17일', 'EP.1 예고 EP.2', '3회차']) assert.equal(extractEpisode(title), null, title);
});
test('episode title uses actual scoped episodes, excluding previews and prior seasons', () => {
  const bot = { channelName: '방판소녀들', titleFilters: ['방판소녀들 시즌2'], minDurationSeconds: 300,
    autoScheduleNext: { titleTemplate: '방판소녀들 시즌2 EP.{episode}', episodeMatch: '방판소녀들 시즌2', episodeOffset: 90 } };
  const videos = [
    { title: '방판소녀들 시즌2 EP.03 예고', duration: 25 },
    { title: '방판소녀들 시즌2 EP.02', duration: 1270 },
    { title: '방판소녀들 시즌2 EP.01', duration: 1200 },
    { title: '방판소녀들 시즌1 EP.12', duration: 1200 },
  ];
  assert.equal(nextEpisodeTitle(bot, videos), '방판소녀들 시즌2 EP.3');
  assert.equal(nextEpisodeTitle(bot, []), '방판소녀들 시즌2 (예정)');
});
