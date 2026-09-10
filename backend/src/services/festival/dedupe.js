/**
 * 수집 큐 ↔ 기존 일정 중복 판정.
 *
 * index.js에서 떼어낸 이유는 하나 — 판정 규칙이 실제 제목에 부딪히며 계속 바뀌는데,
 * 플러그인 안에 있으면 테스트로 못 박을 수가 없다. (test/festival-dedupe.test.js)
 */

const MIN_TITLE_CHARS = 7;
const MIN_TITLE_RATIO = 0.4;

/**
 * 대조용 정규화 — 공백·구두점·괄호를 모두 걷어내고 소문자로.
 * "뮤지컬 <헬스키친> - 박지원 출연" → "뮤지컬헬스키친박지원출연"
 */
export function comparableTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '');
}

/**
 * 제목에서 "그 일정을 가리키는 낱말"만 남긴다.
 *
 * 축제·대학교·콘서트처럼 어느 제목에나 나오는 말은 겹쳐도 같은 일정이라는 근거가 못 된다.
 * 학교명·행사 고유명처럼 그 일정에만 있는 낱말이 겹쳐야 의미가 있다.
 *
 * '인하대학교'는 '인하대학교 축제'로도 '인하대학교 2026 비룡제'로도 쓰이므로
 * 학교명은 접미사를 뗀 형태('인하')도 함께 담는다. 반대로 '명지전문대학교'는
 * '명지전문'이 되어 '명지대학교'('명지')와 겹치지 않는다 — 실제로 다른 학교다.
 */
const GENERIC_WORDS = new Set([
  '축제', '대학교', '대학', '캠퍼스', '학교', '전문대학', '페스티벌', 'festival',
  '콘서트', '공연', '무대', '행사', 'fromis9', 'fromis', '프로미스나인', '프로미스',
  'tour', '투어', 'in', '시즌', 'season', 'ep', '회', '일차', '특집', '방송', '라이브', 'live',
  '서울', '인천', '대전', '대구', '부산', '광주', '울산', '경기', '신촌', '홍대',
]);

export function distinctiveTokens(title) {
  const out = new Set();
  for (const w of String(title || '').toLowerCase().split(/[^0-9a-z가-힣]+/)) {
    if (!w || w.length < 2) continue;
    if (GENERIC_WORDS.has(w)) continue;
    if (/^\d{1,4}$/.test(w)) continue;          // 연도·회차 숫자
    out.add(w);
    const m = /^(.{2,})(대학교|대학|전문대학)$/.exec(w);
    if (m) out.add(m[1]);
  }
  return out;
}

/**
 * 기존 일정과의 중복 여부를 코드로 판정한다.
 *
 * AI(is_duplicate)만 믿었더니 표현이 다르면 놓쳤다. 실제로 놓친 사례:
 *   "뮤지컬 헬스키친"            ↔ "뮤지컬 <헬스키친> - 박지원 출연"
 *   "워터 뮤직 풀 파티"          ↔ "2026 캐리비안 베이 워터 뮤직 풀파티"
 *   "ASIA TOUR TOMRROW GLOW. 1일차" ↔ "2026 fromis_9 ASIA TOUR TOMORROW GLOW."
 * 셋 다 날짜가 정확히 같았으므로, 날짜를 축으로 두 단계로 판정한다.
 *
 * @returns {{kind:'exact'|'suspect', match:object} | null}
 *   exact   — 제목이 서로를 포함. 확실한 중복이라 큐에 담지 않는다.
 *   suspect — 고유 낱말이 겹친다. 담되 "겹칠 수 있음"으로 표시해 사람이 판단한다.
 *
 * 종전에는 같은 날짜·같은 카테고리이기만 하면 무조건 suspect였다. 축제철에는
 * 하루에 여러 학교가 겹치므로 "가천대학교 축제"에 "인하대학교 비룡제"가 중복으로 붙었다
 * (실제로 이 규칙이 낸 힌트는 그 오탐 한 건뿐이었다).
 * 반대로 글자 유사도만 보면 "인하대학교 축제" ↔ "인하대학교 2026 비룡제 : 「BLUE SAGA」"가
 * 0.32로 갈라져 **진짜 중복을 놓친다**. 그래서 고유 낱말이 겹치는지로 판정한다.
 */
export function findExistingMatch(item, existing) {
  if (!item.date) return null;

  // 같은 날짜 + 같은 카테고리만 후보로 둔다.
  // 카테고리를 안 보면 X 일정(💌 계열 1000여 건)과 엉뚱하게 엮인다.
  const candidates = existing.filter(
    e => e.date === item.date && e.category === item.category
  );
  if (candidates.length === 0) return null;

  const a = comparableTitle(item.title);
  if (a.length >= MIN_TITLE_CHARS) {
    const contained = candidates.find(e => {
      const b = comparableTitle(e.title);
      if (b.length < MIN_TITLE_CHARS) return false; // 'me' 같은 짧은 제목은 아무데나 걸린다
      if (!a.includes(b) && !b.includes(a)) return false;
      // 짧은 쪽이 긴 쪽의 일부만 차지하면 우연일 수 있어 '의심'으로 넘긴다
      return Math.min(a.length, b.length) / Math.max(a.length, b.length) >= MIN_TITLE_RATIO;
    });
    if (contained) return { kind: 'exact', match: contained };
  }

  // 고유 낱말이 하나라도 겹치는 후보만 '의심'으로 본다 (많이 겹치는 쪽 우선)
  const at = distinctiveTokens(item.title);
  if (at.size === 0) return null;

  let best = null;
  let bestHits = 0;
  for (const e of candidates) {
    let hits = 0;
    for (const w of distinctiveTokens(e.title)) if (at.has(w)) hits += 1;
    if (hits > bestHits) { best = e; bestHits = hits; }
  }
  return best ? { kind: 'suspect', match: best } : null;
}
