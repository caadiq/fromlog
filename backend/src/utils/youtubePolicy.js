// Shared by ingestion and episode generation. Empty filters impose no restriction.
export const normalize = value => String(value || '').normalize('NFC').toLowerCase();
const matches = (filters, text) => !filters?.length || filters.some(f => normalize(text).includes(normalize(f)));
export function matchesVideoFilters(bot, video) {
  if (bot.filterMode === 'legacy') return matches(bot.titleFilters, `${video.title}\n${video.description || ''}`);
  return matches(bot.titleFilters, video.title) && matches(bot.descriptionFilters, video.description);
}
// null means metadata is not available yet, and must be retried.
export function meetsDuration(bot, video) {
  if (video.videoType === 'shorts' || !(bot.minDurationSeconds > 0)) return true;
  if (!(video.duration > 0)) return null;
  return video.duration >= bot.minDurationSeconds;
}
export function extractEpisode(title) {
  const text = normalize(title);
  const numbers = [...text.matchAll(/(?:\bep(?:isode)?\s*\.?\s*(\d+)|(?:제\s*)?(\d+)\s*[화회](?![가-힣]))/g)]
    .map(m => Number(m[1] || m[2]));
  const unique = [...new Set(numbers)];
  return unique.length === 1 && unique[0] > 0 ? unique[0] : null;
}
export function nextEpisodeTitle(bot, videos) {
  const cfg = bot.autoScheduleNext;
  const template = cfg.titleTemplate || cfg.title || `${bot.channelName} (예정)`;
  if (!template.includes('{episode}')) return template.replaceAll('{channelName}', bot.channelName);
  const scope = cfg.episodeMatch;
  const eligible = videos.filter(v =>
    (!scope || normalize(v.title).includes(normalize(scope))) &&
    matches(bot.titleFilters, v.title) && meetsDuration(bot, v) === true &&
    !/예고|티저|teaser|trailer|하이라이트|직캠/i.test(v.title));
  // Rows arrive newest first. Never mix explicit seasons with previous seasons.
  const seasonOf = title => normalize(title).match(/(?:시즌|season)\s*(\d+)/)?.[1] || null;
  const season = eligible.length ? seasonOf(eligible[0].title) : null;
  const episodes = eligible.filter(v => seasonOf(v.title) === season).map(v => extractEpisode(v.title)).filter(n => n !== null);
  if (!episodes.length || extractEpisode(eligible[0]?.title) === null) return template.replace(/(?:ep(?:isode)?\s*\.?\s*)?\{episode\}\s*[화회]?/i, '').replaceAll('{channelName}', bot.channelName).trim() + ' (예정)';
  return template.replaceAll('{channelName}', bot.channelName).replace('{episode}', Math.max(...episodes) + 1);
}
