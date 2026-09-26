/**
 * URL에서 Open Graph 메타데이터 직접 추출
 * Nitter가 카드를 비워서 줄 때(주로 YouTube) fallback으로 사용.
 */

import { fetchPublicText } from '../../utils/publicFetch.js';

/**
 * HTML 엔티티 디코딩 (이미지 URL의 &amp; 등 처리)
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
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/**
 * HTML에서 og:/twitter: 메타 태그 값 추출 (속성 순서 무관)
 */
function pickMeta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

/**
 * URL의 OG 메타데이터를 가져와 카드 형식으로 반환
 * @param {string} url - 대상 URL
 * @returns {Promise<object|null>} { url, title, description, destination, image } 또는 null
 */
export async function fetchOgCard(url, { fetchText = fetchPublicText } = {}) {
  try {
    const res = await fetchText(url);
    const html = res.text;
    const title = pickMeta(html, 'og:title') || pickMeta(html, 'twitter:title');
    const image = pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image');
    // 제목이나 이미지가 없으면 의미 있는 카드가 아님
    if (!title && !image) return null;

    const description = pickMeta(html, 'og:description') || pickMeta(html, 'twitter:description') || '';
    const siteName = pickMeta(html, 'og:site_name');
    // 최종 리다이렉트된 호스트를 destination으로
    let destination = siteName;
    if (!destination) {
      try { destination = new URL(res.url).hostname.replace(/^www\./, ''); } catch { /* noop */ }
    }

    return {
      url,
      title: title || '',
      description: description.slice(0, 200),
      destination: destination || '',
      image: image || null,
    };
  } catch {
    return null;
  }
}

/**
 * TikTok oEmbed로 썸네일 URL 조회
 * TikTok은 OG 이미지를 막지만 oEmbed는 thumbnail_url을 제공.
 * 단, 반환 URL은 서명·만료형이라 저장하지 말고 온디맨드로 받아 쓸 것.
 * @param {string} url - TikTok 영상 URL (vt.tiktok.com 단축 포함)
 * @returns {Promise<string|null>}
 */
export async function fetchTiktokThumbnail(url, { fetchText = fetchPublicText } = {}) {
  try {
    const res = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { maxBytes: 256 * 1024 });
    const json = JSON.parse(res.text);
    return json.thumbnail_url || null;
  } catch {
    return null;
  }
}

/**
 * 트윗 본문 텍스트에서 첫 외부 URL 추출 (OG fetch 대상)
 * t.co / 단축 URL / 일반 http(s) 모두 대상, x.com 자기 링크는 제외
 */
export function extractFirstUrl(text) {
  if (!text) return null;
  const matches = text.match(/https?:\/\/[^\s]+/g);
  if (!matches) return null;
  for (const u of matches) {
    const clean = u.replace(/[)\]}.,]+$/, '');
    if (/(?:^https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\//i.test(clean)) continue;
    return clean;
  }
  return null;
}
