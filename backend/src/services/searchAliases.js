import { createHash } from 'node:crypto';

const KEY = 'schedule_search_aliases';
const DEFAULT = { groups: [
  { canonical: '프로미스나인', aliases: ['프나', '프미나', 'fromis_9', 'fromis'] },
  { canonical: '건국대학교', aliases: ['건대'] },
], disabledSchools: [] };
export const normalizeTerm = value => String(value || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const revision = raw => createHash('sha256').update(raw ?? 'default-v1').digest('hex');
function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }

export function validateAliases(input) {
  if (!input || !Array.isArray(input.groups) || input.groups.length > 100 || !Array.isArray(input.disabledSchools) || input.disabledSchools.length > 300) fail('별칭 설정 형식이 올바르지 않습니다.');
  const clean = value => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\x00-\x1f]/.test(value)) fail('이름은 1~80자로 입력해주세요.');
    const result = value.trim().normalize('NFC');
    if (normalizeTerm(result).length < 2) fail('검색어는 두 글자 이상 입력해주세요.');
    return result;
  };
  const used = new Set();
  const groups = input.groups.map(group => {
    if (!group || !Array.isArray(group.aliases) || !group.aliases.length || group.aliases.length > 20) fail('대표 이름마다 별칭을 1~20개 입력해주세요.');
    const canonical = clean(group.canonical), aliases = group.aliases.map(clean);
    for (const name of [canonical, ...aliases]) {
      const key = normalizeTerm(name);
      if (used.has(key)) fail(`중복되거나 다른 이름과 겹치는 별칭입니다: ${name}`);
      used.add(key);
    }
    return { canonical, aliases };
  });
  const value = { groups, disabledSchools: [...new Set(input.disabledSchools.map(clean))] };
  if (Buffer.byteLength(JSON.stringify(value)) > 50000) fail('별칭 설정이 너무 큽니다.');
  return value;
}

export function schoolAliases(schools, config) {
  const disabled = new Set(config.disabledSchools.map(normalizeTerm));
  const manual = new Set(config.groups.flatMap(g => [g.canonical, ...g.aliases]).map(normalizeTerm));
  const names = [...new Set(schools.map(s => s.match(/^(.+?대학교)/u)?.[1]).filter(Boolean))];
  return names.map(canonical => ({ canonical, aliases: [canonical.replace(/대학교$/u, '대')] }))
    .filter(g => !manual.has(normalizeTerm(g.aliases[0])))
    .map(g => ({ ...g, enabled: !disabled.has(normalizeTerm(g.canonical)) }));
}

export async function getAliases(db) {
  const [rows] = await db.query('SELECT `value` FROM app_settings WHERE `key` = ?', [KEY]);
  const raw = rows[0]?.value ?? null;
  const config = raw === null ? structuredClone(DEFAULT) : validateAliases(JSON.parse(raw));
  const [schools] = await db.query('SELECT DISTINCT school_name FROM schedule_event WHERE school_name IS NOT NULL');
  return { ...config, revision: revision(raw), automatic: schoolAliases(schools.map(s => s.school_name), config) };
}

export async function saveAliases(db, input) {
  const value = validateAliases(input);
  const [rows] = await db.query('SELECT `value` FROM app_settings WHERE `key` = ?', [KEY]);
  const raw = rows[0]?.value ?? null;
  if (input.revision !== revision(raw)) fail('다른 곳에서 사전이 변경되었습니다. 새로 불러온 뒤 다시 수정해주세요.', 409);
  const next = JSON.stringify(value);
  if (rows.length) {
    const [result] = await db.query('UPDATE app_settings SET `value` = ? WHERE `key` = ? AND BINARY `value` <=> BINARY ?', [next, KEY, raw]);
    if (result.affectedRows === 0) fail('사전이 변경되었습니다. 새로 불러와주세요.', 409);
  } else {
    try { await db.query('INSERT INTO app_settings (`key`, `value`) VALUES (?, ?)', [KEY, next]); }
    catch (error) { if (error.code === 'ER_DUP_ENTRY') fail('사전이 변경되었습니다. 새로 불러와주세요.', 409); throw error; }
  }
  return { ...value, revision: revision(next) };
}

// Expand once at word boundaries; never rewrite substrings such as 지원금 or 건대입구.
export function expandAliases(query, config) {
  const groups = [...config.groups, ...config.automatic.filter(g => g.enabled)];
  const variants = new Set();
  for (const group of groups) {
    for (const alias of group.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'giu');
      const replaced = query.replace(regex, (_, prefix) => prefix + group.canonical);
      if (replaced !== query) variants.add(replaced);
    }
  }
  // Combine independent aliases in a multi-word query without recursive expansion.
  const combined = query.split(/\s+/u).map(word => {
    const group = groups.find(g => g.aliases.some(a => normalizeTerm(a) === normalizeTerm(word)));
    return group?.canonical || word;
  }).join(' ');
  if (combined !== query) variants.add(combined);
  return [...variants].slice(0, 8);
}
