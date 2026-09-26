import { createHash } from 'node:crypto';

const CATEGORIES = new Set(['유튜브', '예능', '콘서트', '행사', '팬사인회', '티켓팅', '기타']);
export const normalizeTitle = title => String(title || '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
export const hash = text => createHash('sha256').update(text).digest('hex');
export function queueKey(item) {
  const title = normalizeTitle(item.title);
  return `${item.date || 'nodate'}|${title.length > 240 ? `sha256:${hash(title)}` : title}`;
}
function invalid(message) {
  return Object.assign(new Error(`Gemini 일정 형식 오류: ${message}`), { code: 'PARSE_FAILED' });
}
export function validateScheduleItems(items) {
  if (!Array.isArray(items)) throw invalid('배열이 아닙니다');
  if (items.length > 500) throw invalid('항목 수가 너무 많습니다');
  return items.map((item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid(`${i + 1}번 항목`);
    const field = (key, max, fallback = '') => {
      const value = item[key] ?? fallback;
      if (typeof value !== 'string' || value.length > max) throw invalid(`${i + 1}번 ${key}`);
      return value.trim().normalize('NFC');
    };
    const title = field('title', 500);
    if (!title) throw invalid(`${i + 1}번 제목 없음`);
    const date = field('date', 10);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) throw invalid(`${i + 1}번 날짜`);
    const time = field('time', 5);
    if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw invalid(`${i + 1}번 시간`);
    const category = field('category', 30, '기타');
    if (!CATEGORIES.has(category)) throw invalid(`${i + 1}번 분류`);
    const members = item.members ?? [];
    if (!Array.isArray(members) || members.length > 20 || members.some(m => typeof m !== 'string' || m.length > 100)) throw invalid(`${i + 1}번 멤버`);
    if (item.is_duplicate != null && typeof item.is_duplicate !== 'boolean') throw invalid(`${i + 1}번 중복 여부`);
    return { ...item, title, date, time, category, members, venue_name: field('venue_name', 200), description: field('description', 10000), dup_reason: field('dup_reason', 1000), is_duplicate: item.is_duplicate === true };
  });
}
