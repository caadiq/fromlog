/**
 * 영상 아카이브 공개 API
 */
import { fetchApi } from '@/api/client';

/**
 * 영상 메인 페이지 (피처드 + 카테고리 섹션 + 쇼츠)
 */
export async function getVideosHome() {
  return fetchApi('/videos/home');
}

/**
 * 영상 목록 (전체보기)
 * @param {object} params - { category, member, channel, shorts, offset, limit }
 */
export async function getVideos(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const q = qs.toString();
  return fetchApi(`/videos${q ? `?${q}` : ''}`);
}
