/**
 * 관리자 일정 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * API 응답을 프론트엔드 형식으로 변환
 * - category 객체 → category_id, category_name, category_color 플랫화
 */
function transformSchedule(schedule) {
  const category = schedule.category || {};

  return {
    ...schedule,
    category_id: category.id,
    category_name: category.name,
    category_color: category.color,
  };
}

/**
 * 일정 목록 조회 (월별)
 * @param {number} year - 년도
 * @param {number} month - 월
 * @returns {Promise<Array>}
 */
export async function getSchedules(year, month) {
  const data = await fetchAuthApi(`/schedules?year=${year}&month=${month}`);
  return (data.schedules || []).map(transformSchedule);
}

/**
 * 일정 검색 (Meilisearch)
 * @param {string} query - 검색어
 * @param {object} options - 페이지네이션 옵션
 * @param {number} options.offset - 시작 위치
 * @param {number} options.limit - 조회 개수
 * @returns {Promise<{schedules: Array, total: number}>}
 */
export async function searchSchedules(query, { offset = 0, limit = 20 } = {}) {
  const data = await fetchAuthApi(
    `/schedules?search=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`
  );
  return {
    ...data,
    schedules: (data.schedules || []).map(transformSchedule),
  };
}

/**
 * 일정 상세 조회
 * @param {number} id - 일정 ID
 * @returns {Promise<object>}
 */
export async function getSchedule(id) {
  return fetchAuthApi(`/schedules/${id}`);
}

/**
 * 일정 삭제
 * @param {number} id - 일정 ID
 * @returns {Promise<void>}
 */
export async function deleteSchedule(id) {
  return fetchAuthApi(`/schedules/${id}`, { method: 'DELETE' });
}

