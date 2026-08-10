import config from '../../config/index.js';
import { formatDate, formatTime } from '../../utils/date.js';

const API_KEY = config.google.apiKey;
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const FETCH_TIMEOUT = 10000;

/**
 * 타임아웃이 있는 fetch (업스트림 행으로 봇/요청이 무한 대기하는 것 방지)
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * ISO 8601 duration (PT1M30S) → 초 변환
 */
function parseDuration(duration) {
  // 프리미어/갓 게시된 영상은 아직 duration이 없을 수 있음 (undefined) → 0초로 처리
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || 0) * 3600 +
    parseInt(match[2] || 0) * 60 +
    parseInt(match[3] || 0)
  );
}

/**
 * 영상 URL 생성
 */
function getVideoUrl(videoId, isShorts) {
  return isShorts
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * 채널의 업로드 플레이리스트 ID 조회
 */
export async function getUploadsPlaylistId(channelId) {
  const url = `${API_BASE}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }
  if (!data.items?.length) {
    throw new Error('채널을 찾을 수 없습니다');
  }

  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

/**
 * 핸들로 채널 조회
 * @param {string} handle - @username 형식 (@ 제외)
 */
export async function getChannelByHandle(handle) {
  // @ 제거
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const url = `${API_BASE}/channels?part=snippet,brandingSettings&forHandle=${cleanHandle}&key=${API_KEY}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }
  if (!data.items?.length) {
    throw new Error('채널을 찾을 수 없습니다');
  }

  const channel = data.items[0];
  const { snippet, brandingSettings } = channel;

  // 배너 URL에 고해상도 파라미터 추가
  const bannerBase = brandingSettings?.image?.bannerExternalUrl;
  const bannerUrl = bannerBase ? `${bannerBase}=w2560` : null;

  return {
    channelId: channel.id,
    handle: cleanHandle,
    title: snippet.title,
    description: snippet.description,
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
    bannerUrl,
  };
}

/**
 * /shorts/{id} 리다이렉트 여부로 쇼츠 정확 판별 (API 쿼터 소모 없음)
 * 쇼츠면 200, 일반 영상이면 /watch로 3xx 리다이렉트된다.
 * 판별 실패 시 null 반환 (호출부에서 duration 기준으로 폴백).
 */
async function checkShortsByRedirect(videoId) {
  try {
    const res = await fetchWithTimeout(`https://www.youtube.com/shorts/${videoId}`, {
      method: 'HEAD',
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) return false;
    if (res.status === 200) return true;
    return null;
  } catch {
    return null;
  }
}

/**
 * 쇼츠에 연결된 본편 영상 조회 (Data API에는 없는 정보 — 쇼츠 페이지 HTML에서 추출)
 * 쇼츠 하단 "이 영상에서" 링크가 watchEndpoint.videoId + accessibilityText(본편 제목)로
 * 페이지 JSON에 들어 있다. 제목·설명란이 모두 빈 쇼츠의 출연자 판별 폴백으로 쓴다.
 * @returns {Promise<{videoId, title}|null>} 연결 영상 없거나 추출 실패 시 null
 */
export async function fetchShortsLinkedVideo(videoId) {
  try {
    const res = await fetchWithTimeout(`https://www.youtube.com/shorts/${videoId}`, {
      // 일반 영상은 /watch로 리다이렉트된다 — watch 페이지의 추천 영상을 잘못 잡지 않도록 따라가지 않는다
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
        'Accept-Language': 'ko',
      },
    });
    if (res.status !== 200) return null;
    const html = await res.text();
    const m = html.match(
      /"watchEndpoint":\{"videoId":"([\w-]{11})"\}\}\},"accessibilityText":"((?:[^"\\]|\\.)*)"/
    );
    if (!m) return null;
    // JSON 이스케이프(\uXXXX 등) 복원
    const title = JSON.parse(`"${m[2]}"`);
    return { videoId: m[1], title };
  } catch {
    return null;
  }
}

/**
 * 영상 ID 목록으로 Shorts 판별 + 길이 조회
 * 쇼츠는 최대 3분(2024-10 확대)이라 duration만으론 1~3분 쇼츠를 일반 영상으로 오판한다.
 * → 3분 초과는 무조건 일반 영상, 3분 이하만 /shorts 리다이렉트로 정확 판별.
 *
 * 반환: { [videoId]: { isShorts: boolean, seconds: number } }
 * 판별에 쓰고 버리던 초를 함께 돌려준다 — 길이 표시에 추가 API 호출이 들지 않는다.
 */
export async function getVideoDurations(videoIds) {
  const url = `${API_BASE}/videos?part=contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();

  const durations = {};
  if (data.items) {
    for (const v of data.items) {
      const seconds = parseDuration(v.contentDetails.duration);
      let isShorts;
      if (seconds > 180) {
        isShorts = false;
      } else {
        const byRedirect = await checkShortsByRedirect(v.id);
        // 리다이렉트 판별 실패 시 옛 기준(60초 이하)으로 폴백
        isShorts = byRedirect !== null ? byRedirect : seconds <= 60;
      }
      durations[v.id] = { isShorts, seconds };
    }
  }
  return durations;
}

/**
 * 최근 업로드 조회 (Activities API - 1 unit)
 * activities.list가 이미 snippet(제목·설명)을 함께 주므로, 이를 버리지 않고 반환한다.
 * → 제목 필터 같은 사전 판별을 videos.list 추가 호출 없이 수행할 수 있어 쿼터가 절약된다.
 * @param {string} channelId - 채널 ID
 * @param {number} maxResults - 최대 결과 수
 * @returns {Promise<Array<{videoId,title,description,channelId,channelTitle,publishedAt}>>}
 */
export async function fetchRecentUploads(channelId, maxResults = 10) {
  const fetchCount = Math.min(maxResults * 2, 50);
  const url = `${API_BASE}/activities?part=snippet,contentDetails&channelId=${channelId}&type=upload&maxResults=${fetchCount}&key=${API_KEY}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return (data.items || [])
    .filter(item => item.snippet?.type === 'upload' && item.contentDetails?.upload?.videoId)
    .slice(0, maxResults)
    .map(item => ({
      videoId: item.contentDetails.upload.videoId,
      title: item.snippet.title || '',
      description: item.snippet.description || '',
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));
}

/**
 * 전체 영상 조회 (페이지네이션)
 * @param {string} channelId - 채널 ID
 * @param {string} uploadsPlaylistId - 캐싱된 uploads playlist ID (선택)
 */
export async function fetchAllVideos(channelId, uploadsPlaylistId = null) {
  const uploadsId = uploadsPlaylistId || await getUploadsPlaylistId(channelId);
  const videos = [];
  let pageToken = '';

  do {
    const url = `${API_BASE}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const videoIds = data.items.map(item => item.snippet.resourceId.videoId);
    const shortsMap = await getVideoDurations(videoIds);

    for (const item of data.items) {
      const { snippet } = item;
      const videoId = snippet.resourceId.videoId;
      const isShorts = shortsMap[videoId] || false;
      const publishedAt = new Date(snippet.publishedAt);

      videos.push({
        videoId,
        title: snippet.title,
        description: snippet.description || '',
        channelId: snippet.channelId,
        channelTitle: snippet.channelTitle,
        publishedAt,
        date: formatDate(publishedAt),
        time: formatTime(publishedAt),
        videoType: isShorts ? 'shorts' : 'video',
        videoUrl: getVideoUrl(videoId, isShorts),
      });
    }

    pageToken = data.nextPageToken || '';
  } while (pageToken);

  // 과거순 정렬
  videos.sort((a, b) => a.publishedAt - b.publishedAt);
  return videos;
}

/**
 * 단일 영상 정보 조회
 */
export async function fetchVideoInfo(videoId) {
  const url = `${API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();

  if (!data.items?.length) {
    return null;
  }

  const video = data.items[0];
  const { snippet, contentDetails } = video;
  const seconds = parseDuration(contentDetails.duration);
  // 쇼츠는 최대 3분 — 3분 이하는 리다이렉트로 정확 판별 (getVideoDurations와 동일 규칙)
  const isShorts = seconds > 0 && seconds <= 180 && (await checkShortsByRedirect(videoId) ?? seconds <= 60);
  const publishedAt = new Date(snippet.publishedAt);

  return {
    videoId,
    title: snippet.title,
    description: snippet.description || '',
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
    publishedAt,
    date: formatDate(publishedAt),
    time: formatTime(publishedAt),
    videoType: isShorts ? 'shorts' : 'video',
    duration: seconds,
    videoUrl: getVideoUrl(videoId, isShorts),
  };
}
