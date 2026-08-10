/**
 * DC 갤러리 "앞으로 일정" 스크래퍼 (구 블로그 검색 방식 대체)
 * 필굿 등이 거의 매일 올리는 "앞으로 일정 스케줄" 글을 긁어와 본문 텍스트를 추출한다.
 * 최신 글 하나에 향후 일정이 누적돼 있어, 최신 글 1개만 파싱하면 충분하다.
 */

const FETCH_TIMEOUT = 15000;
// DC 모바일은 브라우저 UA를 요구
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('요청 타임아웃');
    throw err;
  }
}

/** 퍼센트 인코딩 디코딩 (실패 시 원본) */
export function decodeUrl(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** 검색 목록에서 최신 글 번호 추출 */
async function findLatestPostNo(listUrl, log) {
  const html = await (await fetchWithTimeout(listUrl)).text();
  const m = html.match(/board\/[a-z0-9_]+\/(\d+)/i);
  if (!m) {
    log?.warn?.('[dcbot] 목록에서 게시글을 찾지 못함');
    return null;
  }
  return m[1];
}

/** 게시글 본문 텍스트 추출 (광고 script 제거, 일정 구간만) */
function extractBodyText(html) {
  const m = html.match(/<div[^>]*class="[^"]*(?:thum-txtin|write_div)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  let body = m ? m[1] : html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const idx = body.indexOf('ㅡㅡ');
  if (idx >= 0) body = body.slice(idx).replace(/^ㅡ+/, '').trim();
  return body;
}

/** 갤러리 board slug 추출 (기본 fromis) */
function boardSlug(listUrl) {
  const m = listUrl.match(/board\/([a-z0-9_]+)/i);
  return m ? m[1] : 'fromis';
}

/**
 * 최신 "앞으로 일정" 글을 가져와 본문 반환
 * @param {string} listUrl - DC 검색 목록 URL (bot_festival.search_url)
 * @returns {Promise<{postNo, postUrl, title, body}|null>}
 */
export async function fetchLatestSchedulePost(listUrl, log = null) {
  const postNo = await findLatestPostNo(listUrl, log);
  if (!postNo) return null;

  const slug = boardSlug(listUrl);
  const postUrl = `https://m.dcinside.com/board/${slug}/${postNo}`;
  const html = await (await fetchWithTimeout(postUrl)).text();
  const title = (html.match(/<span class="tit">([^<]+)<\/span>/) || [])[1]?.trim() || '앞으로 일정';
  const body = extractBodyText(html);

  if (!body || body.length < 20) {
    log?.warn?.(`[dcbot] 본문 추출 실패 (post ${postNo})`);
    return null;
  }
  return { postNo, postUrl, title, body };
}
