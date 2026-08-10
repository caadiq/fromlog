/**
 * 스케줄 API
 */
import { fetchApi, fetchAuthApi } from '@/api/client';
import { getTodayKST } from '@/utils';

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

// ==================== 공개 API ====================

/**
 * 스케줄 목록 조회 (월별)
 */
export async function getSchedules(year, month) {
  const data = await fetchApi(`/schedules?year=${year}&month=${month}`);
  return (data.schedules || []).map(transformSchedule);
}

/**
 * 다가오는 스케줄 조회
 */
export async function getUpcomingSchedules(limit = 3) {
  const today = getTodayKST();
  const data = await fetchApi(`/schedules?startDate=${today}&limit=${limit}`);
  return (data.schedules || []).map(transformSchedule);
}

/**
 * 스케줄 검색 (Meilisearch)
 */
export async function searchSchedules(query, { offset = 0, limit = 20 } = {}) {
  const data = await fetchApi(
    `/schedules?search=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`
  );
  return {
    ...data,
    schedules: (data.schedules || []).map(transformSchedule),
  };
}

/**
 * 검색어 자동완성 (bi-gram 학습 기반)
 */
export async function getSuggestions(query, limit = 10) {
  const data = await fetchApi(
    `/schedules/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return data.suggestions || [];
}

/**
 * 스케줄 상세 조회
 */
export async function getSchedule(id) {
  return fetchApi(`/schedules/${id}`);
}

/**
 * 카테고리 목록 조회
 */
export async function getCategories() {
  return fetchApi('/schedules/categories');
}

// ==================== 어드민 API ====================

// ==================== 카테고리 어드민 API ====================

