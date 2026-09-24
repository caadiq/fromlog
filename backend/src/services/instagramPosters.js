import sharp from 'sharp';

const MB = 1024 * 1024;
const unavailable = '게시물 이미지를 가져오지 못했습니다. 공개 게시물 링크인지 확인하거나 파일 첨부를 이용해주세요.';

export function normalizeInstagramPost(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('인스타그램 게시물 링크를 입력해주세요.'); }
  const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{1,64})\/?$/);
  if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname) || url.port || url.username || url.password || !match) {
    throw new Error('https://www.instagram.com/p/... 형식의 게시물 링크를 입력해주세요.');
  }
  return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}

export function isInstagramImageUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      ['cdninstagram.com', 'fbcdn.net'].some((domain) => url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

function extractInstagramMedia(html) {
  const match = html.match(/"contextJSON"\s*:\s*("(?:\\.|[^"\\])*")/);
  if (!match) throw new Error(unavailable);
  let media;
  try { media = JSON.parse(JSON.parse(match[1])).gql_data?.shortcode_media; } catch { throw new Error(unavailable); }
  if (!media) throw new Error(unavailable);
  return media;
}

export function extractInstagramCaption(html) {
  const media = extractInstagramMedia(html);
  const caption = (media.edge_media_to_caption?.edges || []).map(edge => edge.node?.text || '').join('\n').trim();
  if (!caption) throw new Error('게시글 본문이 없습니다. 제목을 직접 입력해주세요.');
  return caption.slice(0, 20000);
}

export async function importInstagramCaption(input, { fetcher = fetch, signal = AbortSignal.timeout(15000) } = {}) {
  const postUrl = normalizeInstagramPost(input);
  const html = await fetchLimited(`${postUrl}embed/`, 4 * MB, signal, fetcher);
  return { postUrl, caption: extractInstagramCaption(html.toString('utf8')) };
}

export function extractInstagramImages(html) {
  const media = extractInstagramMedia(html);
  const nodes = media.edge_sidecar_to_children?.edges?.map((edge) => edge.node) || [media];
  const urls = [...new Set(nodes.filter((node) => node && !node.is_video).map((node) => node.display_url).filter(Boolean))];
  if (!urls.length) throw new Error('가져올 사진이 없습니다. 영상 게시물은 파일 첨부를 이용해주세요.');
  if (urls.length > 20 || urls.some((url) => !isInstagramImageUrl(url))) throw new Error(unavailable);
  return urls;
}

async function fetchLimited(url, limit, signal, fetcher) {
  const response = await fetcher(url, {
    signal, redirect: 'error',
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
  });
  if (!response.ok || !response.body) throw new Error(unavailable);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    if (Number(response.headers.get('content-length')) > limit) throw new Error('게시물 이미지 용량이 너무 큽니다. 파일 첨부를 이용해주세요.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('게시물 이미지 용량이 너무 큽니다. 파일 첨부를 이용해주세요.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

// No cookies, credentials, AI calls, or persistent storage are used here.
export async function importInstagramPosters(input, { fetcher = fetch, signal = AbortSignal.timeout(60000) } = {}) {
  const postUrl = normalizeInstagramPost(input);
  const html = await fetchLimited(`${postUrl}embed/`, 4 * MB, signal, fetcher);
  const urls = extractInstagramImages(html.toString('utf8'));
  const images = [];
  let remaining = 25 * MB;
  let outputBytes = 0;
  for (let index = 0; index < urls.length; index++) {
    signal.throwIfAborted();
    const buffer = await fetchLimited(urls[index], Math.min(8 * MB, remaining), signal, fetcher);
    remaining -= buffer.length;
    const image = sharp(buffer, { limitInputPixels: 40000000 });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error(unavailable);
    const output = await image.rotate().resize({ width: 2160, height: 2160, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
    outputBytes += output.length;
    if (outputBytes > 25 * MB) throw new Error(unavailable);
    images.push({ name: `instagram-${postUrl.split('/')[4]}-${index + 1}.jpg`, dataUrl: `data:image/jpeg;base64,${output.toString('base64')}` });
  }
  return { postUrl, images };
}
