/**
 * 관리자 활동 로그 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 활동 로그 목록 조회
 * @param {object} params - 쿼리 파라미터
 * @param {number} [params.page] - 페이지 번호
 * @param {number} [params.limit] - 페이지당 개수
 * @param {string} [params.category] - 카테고리 필터 (콤마 구분)
 * @param {string} [params.actor] - 행위자 필터 (admin 또는 bot)
 * @param {string} [params.search] - summary 검색
 * @param {string} [params.from] - 시작 날짜 (YYYY-MM-DD)
 * @param {string} [params.to] - 종료 날짜 (YYYY-MM-DD)
 * @returns {Promise<{logs: Array, total: number, page: number, limit: number, totalPages: number}>}
 */
/**
 * 로그 카테고리 목록 조회
 * @returns {Promise<{categories: string[]}>}
 */
export async function getLogCategories() {
  return fetchAuthApi('/admin/logs/categories');
}

export async function getLogs(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  return fetchAuthApi(`/admin/logs${qs ? `?${qs}` : ''}`);
}
