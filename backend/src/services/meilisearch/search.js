import Inko from 'inko';
import { getAliases, expandAliases, normalizeTerm } from '../searchAliases.js';
import { getSchedulesByIds } from '../schedule.js';
import config from '../../config/index.js';
const inko = new Inko();
const baseTitle = value => normalizeTerm(value).replace(/(?:제?\d+[회화]|ep\d+)$/iu, '');
const episode = value => normalizeTerm(value).match(/(?:제?(\d+)[회화]|ep(\d+))$/iu)?.slice(1).find(Boolean);

export function relevanceTier(hit, original, aliases) {
  const title = normalizeTerm(hit.title), q = normalizeTerm(original);
  if (title === q || baseTitle(hit.title) === q) return 0;
  if (title.includes(q)) return 1;
  if (aliases.some(a => title === normalizeTerm(a) || baseTitle(hit.title) === normalizeTerm(a))) return 2;
  if (aliases.some(a => title.includes(normalizeTerm(a)))) return 3;
  return 4;
}

export async function searchSchedules(meilisearch, db, input, options = {}) {
  const { limit = 100, offset = 0 } = options;
  const query = input.normalize('NFC').trim();
  if (!query) return { hits: [], total: 0, offset, limit, hasMore: false };
  const aliases = await getAliases(db);
  const expanded = expandAliases(query, aliases);
  const index = meilisearch.index('schedules');
  const compact = normalizeTerm(query);
  const requestedEpisode = episode(query);
  const queries = [...new Set([query, ...(compact !== query.toLowerCase() ? [compact] : []), ...expanded])];
  const all = new Map();
  async function run(q, matchingStrategy = 'all', titleFallback = false) {
    // Keep exact totals and custom ranking while transferring only lightweight candidates.
    const result = await index.search(q, {
      limit: 10000, offset: 0, matchingStrategy, showRankingScore: true,
      attributesToRetrieve: ['id', 'title', 'date', 'time', 'source_name', 'broadcaster'],
      ...(titleFallback ? { attributesToSearchOn: ['title', 'source_name'] } : {}),
    });
    for (const hit of result.hits) {
      if (hit._rankingScore < config.meilisearch.minScore) continue;
      const resultEpisode = episode(hit.title);
      if (requestedEpisode && resultEpisode && Number(requestedEpisode) !== Number(resultEpisode)) continue;
      // Known short aliases must not introduce typo matches such as 건대 -> 군대.
      if (expanded.length && (q === query || q === compact) && ![hit.title, hit.source_name, hit.broadcaster].some(v => normalizeTerm(v).includes(compact))) continue;
      const previous = all.get(hit.id);
      if (!previous || previous._rankingScore < hit._rankingScore) all.set(hit.id, hit);
    }
  }
  await Promise.all(queries.map(q => run(q)));
  // Genuine English titles keep their own results; keyboard recovery is a fallback.
  if (!all.size && /[a-z]/i.test(query) && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(query)) {
    const korean = inko.en2ko(query);
    if (korean !== query) await run(korean);
  }
  // Preserve typo recovery for single terms without discarding words from a multi-term query.
  if (!expanded.length && !/\s|\d/u.test(query) && query.length >= 3 && ![...all.values()].some(hit => normalizeTerm(hit.title).includes(compact))) await run(query, 'last', true);
  const hits = [...all.values()];
  const tiers = new Map(hits.map(hit => [hit.id, relevanceTier(hit, query, expanded)]));
  hits.sort((a, b) => {
    const at = tiers.get(a.id), bt = tiers.get(b.id);
    const dateOrder = String(b.date).localeCompare(String(a.date)) || String(b.time || '').localeCompare(String(a.time || '')) || Number(b.id) - Number(a.id);
    return at - bt || ((at === 0 || at === 2) ? dateOrder : ((b._rankingScore || 0) - (a._rankingScore || 0) || dateOrder));
  });
  // Remove stale index IDs with a cheap primary-key lookup before slicing, without joining every result.
  const live = new Set();
  for (let start = 0; start < hits.length; start += 500) {
    const ids = hits.slice(start, start + 500).map(h => h.id);
    const [rows] = await db.query(`SELECT id FROM schedules WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    rows.forEach(row => live.add(Number(row.id)));
  }
  const valid = hits.filter(hit => live.has(Number(hit.id)));
  const page = valid.slice(offset, offset + limit);
  const schedules = await getSchedulesByIds(db, page.map(hit => hit.id));
  const byId = new Map(schedules.map(schedule => [Number(schedule.id), schedule]));
  return { hits: page.map(hit => byId.get(Number(hit.id))).filter(Boolean), total: valid.length, offset, limit, hasMore: offset + limit < valid.length };
}
