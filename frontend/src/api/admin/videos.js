/**
 * 관리자 영상 아카이브 API
 */
import { fetchAuthApi } from '@/api/client';

/** 영상 목록 (필터·검색·페이징) */
export async function getVideos(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') query.set(k, v);
  }
  const qs = query.toString();
  return fetchAuthApi(`/admin/videos${qs ? `?${qs}` : ''}`);
}

/** URL로 영상 정보 미리보기 (등록 전 확인) */
export async function previewVideo(url) {
  return fetchAuthApi(`/admin/videos/preview?url=${encodeURIComponent(url)}`);
}

/** 영상 수동 등록 */
export async function createVideo(data) {
  return fetchAuthApi('/admin/videos', { method: 'POST', body: JSON.stringify(data) });
}

/** 영상 수정 (카테고리·타입) */
export async function updateVideo(videoId, data) {
  return fetchAuthApi(`/admin/videos/${videoId}`, { method: 'PUT', body: JSON.stringify(data) });
}

/** 영상 삭제 */
export async function deleteVideo(videoId) {
  return fetchAuthApi(`/admin/videos/${videoId}`, { method: 'DELETE' });
}
