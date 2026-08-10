/**
 * DC "앞으로 일정" 본문 → Gemini로 구조화 + 카테고리 분류 + 기존 일정 dedup
 * (구 블로그 url_context 방식 대체. 본문 텍스트를 직접 프롬프트로 전달)
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT = 120000;

const RETRYABLE_STATUS = [500, 503, 429];
const MAX_RETRIES = 3;
const RETRY_DELAY = 20000;

/**
 * 프롬프트 생성 — 본문에서 프로미스나인 향후 일정을 구조화/분류하고 기존 일정과 중복 판단
 */
function buildPrompt(bodyText, existing, year) {
  const existingLines = existing.length
    ? existing.map(e => `- ${e.date} ${e.time || ''} [${e.category}] ${e.title}${e.channel ? ' (' + e.channel + ')' : ''}`).join('\n')
    : '(없음)';
  return `아래는 프로미스나인(fromis_9) 팬이 올린 "앞으로 일정" 게시글 본문이다. 여기서 프로미스나인/멤버의 향후 일정을 구조화해 추출하라.

[게시글 본문]
${bodyText}

[이미 DB에 등록된 일정 — 이것과 같은 일정이면 is_duplicate=true]
${existingLines}

규칙:
1. 연도는 ${year}년 기준. 날짜는 "YYYY-MM-DD". 날짜가 아직 미정(예: "?", "미정", 요일만 있음)이면 date를 빈 문자열("")로 두되 그 항목도 포함하라(나중에 날짜가 정해지면 채운다).
2. time은 "HH:MM"(24시간). 없으면 빈 문자열.
3. category는 다음 중 정확히 하나:
   - "유튜브": 프로미스나인 공식/자체 유튜브 콘텐츠 (스프, 이단장, 워크돌, K판 입덕투어 등 웹예능/영상)
   - "예능": TV·OTT 정규 예능/버라이어티 (고나리돌 등 편성 프로그램)
   - "콘서트": 단독/합동 콘서트, 투어
   - "행사": 페스티벌·외부 행사·풀파티·대학축제 등 (캐리비안베이 워터뮤직 등)
   - "팬사인회": 팬사인회/팬미팅
   - "티켓팅": 예매 오픈 일정
   - "기타": 위 어디에도 안 맞는 단발 출연 (라디오, 뮤지컬 등)
4. members: 참여 멤버명 배열(본문에 ": 지원 하영"처럼 적힌 경우). 없으면 빈 배열.
5. venue_name: 장소가 본문에 있으면 장소명(공연장·극장 등). 없으면 빈 문자열. (좌표는 나중에 처리하니 이름만)
6. description: 부가 설명이 있으면 한 줄로. 없으면 빈 문자열.
7. is_duplicate: 위 "이미 DB에 등록된 일정"과 같은 일정이면 true(날짜+내용 대응). 아니면 false.
8. dup_reason: is_duplicate=true면 어떤 기존 일정과 겹치는지 한 줄. 아니면 빈 문자열.
9. 본문에 적힌 정보만 사용(추론 금지).

출력: JSON 배열만. 코드블록/설명 없이.
[
  {"date":"YYYY-MM-DD","time":"HH:MM","title":"일정 제목","category":"기타","members":["지원"],"venue_name":"","description":"","is_duplicate":false,"dup_reason":""}
]`;
}

function parseJsonArray(text) {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
  }
  if (!clean.startsWith('[')) {
    const m = clean.match(/\[[\s\S]*\]/);
    if (m) clean = m[0];
  }
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const err = new Error(`Gemini가 JSON이 아닌 응답을 반환: ${text.trim().slice(0, 120)}`);
    err.code = 'PARSE_FAILED';
    throw err;
  }
  if (!Array.isArray(parsed)) {
    const err = new Error('Gemini 응답이 배열이 아닙니다');
    err.code = 'PARSE_FAILED';
    throw err;
  }
  return parsed;
}

async function callGemini(prompt, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.05 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Gemini API 오류 ${res.status}: ${errText.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Gemini API 요청 타임아웃');
    throw err;
  }
}

/**
 * 본문 텍스트에서 일정 항목 추출 (분류 + dedup 포함)
 * @param {string} bodyText - DC 게시글 본문
 * @param {Array} existing - [{date, time, category, title, channel}] 기존 일정 (dedup용)
 * @param {string} apiKey - Gemini API 키
 * @param {number} year - 기준 연도
 * @returns {Promise<Array>} [{date,time,title,category,members,venue_name,description,is_duplicate,dup_reason}]
 */
export async function extractScheduleItems(bodyText, existing, apiKey, year) {
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
  if (!bodyText) return [];

  const prompt = buildPrompt(bodyText, existing, year);

  let result;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      result = await callGemini(prompt, apiKey);
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && RETRYABLE_STATUS.includes(err.status)) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }
      throw err;
    }
  }
  if (!result) throw lastErr;

  const text = result?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text.trim()) {
    const err = new Error('Gemini 응답이 비어 있습니다');
    err.code = 'PARSE_FAILED';
    throw err;
  }
  return parseJsonArray(text);
}
