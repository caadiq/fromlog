/**
 * 수집 큐 ↔ 기존 일정 중복 판정.
 *
 * index.js에서 떼어낸 이유는 하나 — 판정 규칙이 실제 제목에 부딪히며 계속 바뀌는데,
 * 플러그인 안에 있으면 테스트로 못 박을 수가 없다. (test/festival-dedupe.test.js)
 */

// 제목 포함관계로 '확실한 중복'이라 단정할 최소 조건.
// X 일정에는 'ME', 'MEEEEE' 같은 짧은 제목이 있어 길이 제한이 없으면 아무 데나 걸린다.
// 실제 사례("뮤지컬헬스키친" 7자 ⊂ 12자 = 0.58, "워터뮤직풀파티" 7자 ⊂ 17자 = 0.41)를 통과시키는 값.
const MIN_TITLE_CHARS = 7;
const MIN_TITLE_RATIO = 0.4;

/**
 * 대조용 정규화 — 공백·구두점·괄호를 모두 걷어내고 소문자로.
 * "뮤지컬 <헬스키친> - 박지원 출연" → "뮤지컬헬스키친박지원출연"
 */
export function comparableTitle(title) {
  return String(title || '')
    // 유튜브 API는 한글을 자모 분해형(NFD)으로 준다. 조합형으로 맞추지 않으면
    // 아래 [가-힣] 필터에 한 글자도 안 걸려 문자열이 통째로 비고, 판정이 무력화된다.
    .normalize('NFC')
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

export /**
 * 낱말 꼬리에 붙어 고유성을 흐리는 말 — 긴 것부터 떼어낸다.
 *
 * '전문대학교'는 일부러 넣지 않는다. 통째로 떼면 '명지전문대학교'가 '명지'가 되어
 * '명지대학교'와 같아지는데, 둘은 다른 학교다. '대학교'만 떼어 '명지전문'으로 남긴다.
 */
const GENERIC_SUFFIXES = ['대학교', '대학', '캠퍼스', '축제', '페스티벌', '콘서트', '공연'];

export function distinctiveTokens(title) {
  const out = new Set();
  for (let w of String(title || '').normalize('NFC').toLowerCase().split(/[^0-9a-z가-힣]+/)) {
    if (!w) continue;
    // '서울캠퍼스'처럼 흔한 말끼리 붙은 합성어는 공백이 없어 한 낱말로 남는다.
    // 꼬리에 붙은 흔한 말을 떼어내야 '홍익대 서울캠퍼스'와 '광운대 서울캠퍼스'가 안 엮인다.
    let cut = true;
    while (cut) {
      cut = false;
      for (const g of GENERIC_SUFFIXES) {
        if (w.length > g.length && w.endsWith(g)) { w = w.slice(0, -g.length); cut = true; break; }
      }
    }
    if (w.length < 2) continue;
    if (GENERIC_WORDS.has(w)) continue;
    if (/^\d{1,4}$/.test(w)) continue;          // 연도·회차 숫자
    out.add(w);
    // '국립한밭대학교'와 '한밭대학교'가 만나도록 기관 접두어도 뗀 형태를 담는다
    const bare = w.replace(/^(국립|사립|공립)/, '');
    if (bare.length >= 2 && bare !== w) out.add(bare);
  }
  return out;
}

/**
 * 짧은 제목이 긴 제목의 **앞부분**일 때, 뒤에 남는 꼬리가 형제 일정을 가르는 표시인지 본다.
 *
 * 뒤만 보는 이유 — 앞에 붙는 말은 대개 수식어라 같은 일정이다.
 *   '워터 뮤직 풀 파티' ⊂ '2026 캐리비안 베이 워터 뮤직 풀파티'   (같은 일정)
 * 반면 뒤에 붙는 숫자·괄호는 같은 행사의 **다른 회차·다른 주최**를 가리킨다.
 *   'K판 입덕투어2 EP.1'          ⊂ 'K판 입덕투어2 EP.10'
 *   'TOMORROW GLOW.'              ⊂ 'TOMORROW GLOW. 2회차'
 *   '[Glow ME] 발매 기념 팬사인회' ⊂ '[Glow ME] 발매 기념 팬사인회 (메이크스타)'
 * 이걸 exact로 두면 큐에 담지 않고 건너뛰므로 **다른 일정을 통째로 잃는다**.
 *
 * 숫자도 괄호도 없는 설명 꼬리('- 박지원 출연')는 같은 일정이라 그대로 exact로 둔다.
 */
function siblingTail(titleA, titleB) {
  const x = comparableTitle(titleA);
  const y = comparableTitle(titleB);
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  const longRaw = String(x.length <= y.length ? titleB : titleA).trim();

  if (!long.startsWith(short)) return null;   // 남는 부분이 앞쪽이면 수식어다
  const tail = long.slice(short.length);
  if (!tail) return null;                     // 완전히 같은 제목
  if (/\d/.test(tail)) return tail;           // 회차·EP·일차 번호
  if (/[([{（【][^)\]}）】]*[)\]}）】]$/.test(longRaw)) return tail;  // 끝의 (주최명)
  return null;
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
    if (contained) {
      // 포함관계여도 뒤에 붙은 꼬리가 회차·주최를 가르는 표시면 건너뛰지 않는다.
      // 건너뛰면 같은 날 다른 업체 팬사인회나 다음 회차를 잃는다.
      if (siblingTail(item.title, contained.title)) return { kind: 'suspect', match: contained };
      return { kind: 'exact', match: contained };
    }
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
