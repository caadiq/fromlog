import { parseNitterDateTime } from '../../utils/date.js';

const FETCH_TIMEOUT = 10000; // 10초

/**
 * 타임아웃이 적용된 fetch
 */
async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('요청 타임아웃');
    }
    throw err;
  }
}

/**
 * HTML 엔티티 디코딩 (Nitter가 &#x2F; &amp; 등으로 이스케이프한 텍스트 복원)
 */
function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ');
}

/**
 * 트윗 텍스트에서 첫 문단 추출 (title용)
 */
export function extractTitle(text) {
  if (!text) return '';
  const paragraphs = text.split(/\n\n+/);
  return paragraphs[0]?.trim() || '';
}

/**
 * HTML에서 이미지 URL 추출
 */
export function extractImageUrls(html) {
  const urls = [];
  const regex = /href="\/pic\/(orig\/)?media%2F([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const mediaPath = decodeURIComponent(match[2]);
    const cleanPath = mediaPath.split('%3F')[0].split('?')[0];
    urls.push(`https://pbs.twimg.com/media/${cleanPath}`);
  }
  return [...new Set(urls)];
}

/**
 * HTML에서 영상/GIF 썸네일 URL 추출
 * Nitter는 영상 파일을 제공하지 않고 썸네일만 노출 (amplify_video_thumb,
 * ext_tw_video_thumb, tweet_video_thumb). 재생은 원본 트윗으로 이동.
 */
export function extractVideoThumbnails(html) {
  const urls = [];
  const regex = /<img src="(\/pic\/[^"]*video_thumb[^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const path = decodeURIComponent(match[1].replace(/^\/pic\//, '')).split('?')[0];
    urls.push(`https://pbs.twimg.com/${path}`);
  }
  return [...new Set(urls)];
}

/**
 * HTML에서 링크 미리보기 카드(Open Graph) 추출
 * Nitter가 트윗의 외부 링크에 대해 카드를 직접 렌더링하므로 그대로 파싱.
 * 트윗당 최대 1개. 카드가 없으면 null.
 */
export function extractCard(html) {
  if (!html.includes('card-container')) return null;
  const hrefMatch = html.match(/<a class="card-container" href="([^"]+)"/);
  if (!hrefMatch) return null;

  const stripTags = s => (s ? decodeEntities(s.replace(/<[^>]+>/g, '').trim()) : '');
  const titleMatch = html.match(/<h2 class="card-title">([\s\S]*?)<\/h2>/);
  const descMatch = html.match(/<p class="card-description">([\s\S]*?)<\/p>/);
  const destMatch = html.match(/<span class="card-destination">([\s\S]*?)<\/span>/);
  const imgMatch = html.match(/<img src="(\/pic\/card_img[^"]+)"/);

  let image = null;
  if (imgMatch) {
    image = `https://pbs.twimg.com/${decodeURIComponent(imgMatch[1].replace(/^\/pic\//, ''))}`;
  }

  const title = stripTags(titleMatch?.[1]);
  // 제목이나 이미지 중 하나는 있어야 유효한 카드
  if (!title && !image) return null;

  return {
    url: hrefMatch[1],
    title,
    description: stripTags(descMatch?.[1]),
    destination: stripTags(destMatch?.[1]),
    image,
  };
}

/**
 * 텍스트에서 유튜브 videoId 추출
 */
export function extractYoutubeVideoIds(text) {
  if (!text) return [];
  const ids = new Set();

  // youtu.be/{id}
  const shortRegex = /youtu\.be\/([a-zA-Z0-9_-]{11})/g;
  let m;
  while ((m = shortRegex.exec(text)) !== null) {
    ids.add(m[1]);
  }

  // youtube.com/watch?v={id}
  const watchRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g;
  while ((m = watchRegex.exec(text)) !== null) {
    ids.add(m[1]);
  }

  // youtube.com/shorts/{id}
  const shortsRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/g;
  while ((m = shortsRegex.exec(text)) !== null) {
    ids.add(m[1]);
  }

  return [...ids];
}

/**
 * HTML에서 프로필 정보 추출
 */
export function extractProfile(html) {
  const profile = { displayName: null, avatarUrl: null };

  const nameMatch = html.match(/class="profile-card-fullname"[^>]*title="([^"]+)"/);
  if (nameMatch) {
    profile.displayName = nameMatch[1].trim();
  }

  const avatarMatch = html.match(/class="profile-card-avatar"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
  if (avatarMatch) {
    let url = avatarMatch[1];
    const encodedMatch = url.match(/\/pic\/(.+)/);
    if (encodedMatch) {
      url = decodeURIComponent(encodedMatch[1]);
    }
    profile.avatarUrl = url;
  }

  return profile;
}

/**
 * 트윗 HTML 컨텐츠에서 텍스트 추출 (링크는 원본 URL 사용)
 */
function extractTextFromHtml(html) {
  const stripped = html
    .replace(/<br\s*\/?>/g, '\n')
    // <a> 태그: href에서 원본 URL 추출 (외부 링크만)
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, (match, href, text) => {
      // t.co 링크: Nitter가 프록시한 URL을 원본 t.co URL로 변환
      const tcoMatch = href.match(/\/t\.co\/([^\s"?]+)/);
      if (tcoMatch) {
        return `https://t.co/${tcoMatch[1]}`;
      }
      // Nitter 내부 링크 (/search, /hashtag 등)는 표시 텍스트 사용
      if (href.startsWith('/')) {
        return text;
      }
      // 외부 링크는 href의 원본 URL 사용
      return href;
    })
    .replace(/<[^>]+>/g, '')
    .trim();
  return decodeEntities(stripped);
}

/**
 * HTML에서 트윗 목록 파싱
 * @param {string} html - HTML 문자열
 * @param {string} username - 사용자명
 * @param {object} options - 옵션
 * @param {boolean} options.includeRetweets - 리트윗 포함 여부 (기본: false)
 */
export function parseTweets(html, username, options = {}) {
  const { includeRetweets = false } = options;
  const tweets = [];
  const containers = html.split('class="timeline-item ');

  for (let i = 1; i < containers.length; i++) {
    const container = containers[i];

    // 고정 트윗 제외
    const isPinned = container.includes('class="pinned"');
    if (isPinned) continue;

    // 리트윗 필터링 (옵션에 따라)
    const isRetweet = container.includes('class="retweet-header"');
    if (isRetweet && !includeRetweets) continue;

    // 리트윗인 경우 원본 작성자 추출 (data-username 또는 tweet-header에서)
    let originalUsername = null;
    if (isRetweet) {
      const dataUserMatch = containers[i - 1]?.match(/data-username="([^"]+)"/) ||
                            container.match(/data-username="([^"]+)"/);
      if (dataUserMatch) {
        originalUsername = dataUserMatch[1];
      } else {
        // tweet-header의 username 링크에서 추출
        const headerUserMatch = container.match(/class="username"[^>]*href="\/([^"]+)"/);
        if (headerUserMatch) {
          originalUsername = headerUserMatch[1];
        }
      }
    }

    // 트윗 ID
    const idMatch = container.match(/href="\/[^\/]+\/status\/(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // 시간
    const timeMatch = container.match(/<span class="tweet-date"[^>]*><a[^>]*title="([^"]+)"/);
    const time = timeMatch ? parseNitterDateTime(timeMatch[1]) : null;
    if (!time) continue;

    // 텍스트
    const contentMatch = container.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let text = '';
    if (contentMatch) {
      text = extractTextFromHtml(contentMatch[1]);
    }

    // 이미지 / 영상 썸네일 / 링크 카드
    const imageUrls = extractImageUrls(container);
    const videoThumbnails = extractVideoThumbnails(container);
    const card = extractCard(container);

    tweets.push({
      id,
      time,
      text,
      imageUrls,
      videoThumbnails,
      card,
      isRetweet,
      originalUsername,
      // 긴 트윗이 잘렸는지 여부 (hydrate 대상 판별용)
      // …로 끝나거나, 본문에 status 링크를 가진 "Show more"가 있으면 잘린 것.
      // 페이지네이션 Show more(href="?cursor=...")와 인용(quote) 영역의 Show more는 제외.
      truncated:
        /…\s*$/.test(text) ||
        /class="show-more"><a href="[^"]*\/status\/\d+/i.test(container.split('class="quote')[0]),
      url: isRetweet && originalUsername
        ? `https://x.com/${originalUsername}/status/${id}`
        : `https://x.com/${username}/status/${id}`,
    });
  }

  return tweets;
}

/**
 * Nitter에서 단일 트윗 조회
 */
export async function fetchSingleTweet(nitterUrl, username, postId) {
  const url = `${nitterUrl}/${username}/status/${postId}`;
  const res = await fetchWithTimeout(url);
  const html = await res.text();

  // 메인 트윗 파싱 (main-tweet ~ replies 사이)
  const mainTweetMatch = html.match(/<div id="m" class="main-tweet">([\s\S]*?)<div id="r" class="replies">/);
  if (!mainTweetMatch) {
    throw new Error('트윗 내용을 파싱할 수 없습니다');
  }

  const container = mainTweetMatch[1];

  // 시간
  const timeMatch = container.match(/<span class="tweet-date"[^>]*><a[^>]*title="([^"]+)"/);
  const time = timeMatch ? parseNitterDateTime(timeMatch[1]) : null;

  // 텍스트
  const contentMatch = container.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  let text = '';
  if (contentMatch) {
    text = extractTextFromHtml(contentMatch[1]);
  }

  // 이미지 / 영상 썸네일 / 링크 카드
  const imageUrls = extractImageUrls(container);
  const videoThumbnails = extractVideoThumbnails(container);
  const card = extractCard(container);

  // 프로필 정보
  const profile = extractProfile(html);

  return {
    id: postId,
    time,
    text,
    imageUrls,
    videoThumbnails,
    card,
    url: `https://x.com/${username}/status/${postId}`,
    profile,
  };
}

/**
 * Nitter에서 프로필 정보만 조회
 */
export async function fetchProfile(nitterUrl, username) {
  const url = `${nitterUrl}/${username}`;
  const res = await fetchWithTimeout(url);
  const html = await res.text();

  // 프로필이 존재하는지 확인
  if (html.includes('Error: User') || html.includes('User not found')) {
    throw new Error('사용자를 찾을 수 없습니다');
  }

  const profile = extractProfile(html);

  if (!profile.displayName) {
    throw new Error('프로필 정보를 가져올 수 없습니다');
  }

  return {
    username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  };
}

/**
 * 잘린 트윗(…로 끝나는 긴 트윗)을 개별 상태 페이지에서 재요청해 전체 내용으로 교체
 * - 타임라인이 long tweet을 간헐적으로 잘라서 주는 경우 대비
 * - 재요청 결과가 더 길고 잘리지 않았을 때만 교체 (best-effort)
 * @param {string} nitterUrl - Nitter URL
 * @param {Array} tweets - parseTweets 결과
 * @param {string} username - 타임라인 사용자명 (리트윗 아닌 경우 fallback)
 * @param {object} log - 로거 (선택)
 */
async function hydrateTruncatedTweets(nitterUrl, tweets, username, log) {
  for (const tweet of tweets) {
    if (!tweet.truncated) continue;
    try {
      // status id는 전역 유일 → username 경로는 resolve에 영향 없음
      const author = tweet.originalUsername || username;
      const full = await fetchSingleTweet(nitterUrl, author, tweet.id);
      if (full?.text && full.text.length > tweet.text.length && !/…\s*$/.test(full.text)) {
        tweet.text = full.text;
        if (full.imageUrls?.length > 0) tweet.imageUrls = full.imageUrls;
        tweet.truncated = false;
      }
    } catch (err) {
      log?.warn?.(`[hydrate] 트윗 ${tweet.id} 재요청 실패: ${err.message}`);
    }
    // Nitter 부하 완화
    await new Promise(r => setTimeout(r, 300));
  }
  return tweets;
}

/**
 * Nitter에서 트윗 수집 (첫 페이지만)
 * @param {string} nitterUrl - Nitter URL
 * @param {string} username - 사용자명
 * @param {object} options - 옵션
 * @param {boolean} options.includeRetweets - 리트윗 포함 여부
 * @param {object} options.log - 로거 (선택)
 */
export async function fetchTweets(nitterUrl, username, options = {}) {
  const url = `${nitterUrl}/${username}`;
  const res = await fetchWithTimeout(url);
  const html = await res.text();

  // 프로필 정보
  const profile = extractProfile(html);

  // 트윗 파싱
  const tweets = parseTweets(html, username, options);

  // 잘린 긴 트윗 전체 내용 복원
  await hydrateTruncatedTweets(nitterUrl, tweets, username, options.log);

  return { tweets, profile };
}

/**
 * Nitter에서 전체 트윗 수집 (페이지네이션)
 * @param {string} nitterUrl - Nitter URL
 * @param {string} username - 사용자명
 * @param {object} log - 로거
 * @param {object} options - 옵션
 * @param {boolean} options.includeRetweets - 리트윗 포함 여부
 */
export async function fetchAllTweets(nitterUrl, username, log, options = {}) {
  const allTweets = [];
  let cursor = null;
  let pageNum = 1;
  let emptyCount = 0;

  while (true) {
    const url = cursor
      ? `${nitterUrl}/${username}?cursor=${cursor}`
      : `${nitterUrl}/${username}`;

    log?.info(`[페이지 ${pageNum}] 스크래핑 중...`);

    try {
      const res = await fetchWithTimeout(url);
      const html = await res.text();
      const tweets = parseTweets(html, username, options);

      if (tweets.length === 0) {
        emptyCount++;
        if (emptyCount >= 3) break;
      } else {
        emptyCount = 0;
        // 잘린 긴 트윗 전체 내용 복원
        await hydrateTruncatedTweets(nitterUrl, tweets, username, log);
        allTweets.push(...tweets);
        log?.info(`  -> ${tweets.length}개 추출 (누적: ${allTweets.length})`);
      }

      // 다음 페이지 cursor
      const cursorMatch = html.match(/class="show-more"[^>]*>\s*<a href="\?cursor=([^"]+)"/);
      if (!cursorMatch) break;

      cursor = cursorMatch[1];
      pageNum++;

      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      log?.error(`  -> 오류: ${err.message}`);
      emptyCount++;
      if (emptyCount >= 5) break;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  return allTweets;
}
