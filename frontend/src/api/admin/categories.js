/**
 * 관리자 카테고리 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 카테고리 목록 조회
 * @returns {Promise<Array>}
 */
export async function getCategories() {
  return fetchAuthApi('/schedules/categories');
}

/**
 * 카테고리 생성
 * @param {object} data - 카테고리 데이터
 * @param {string} data.name - 카테고리 이름
 * @param {string} data.color - 색상 코드
 * @returns {Promise<object>}
 */
export async function createCategory(data) {
  return fetchAuthApi('/admin/schedule-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 카테고리 수정
 * @param {number} id - 카테고리 ID
 * @param {object} data - 카테고리 데이터
 * @returns {Promise<object>}
 */
export async function updateCategory(id, data) {
  return fetchAuthApi(`/admin/schedule-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 카테고리 삭제
 * @param {number} id - 카테고리 ID
 * @returns {Promise<void>}
 */
export async function deleteCategory(id) {
  return fetchAuthApi(`/admin/schedule-categories/${id}`, { method: 'DELETE' });
}

/**
 * 카테고리 순서 변경
 * @param {Array<{id: number, sort_order: number}>} orders - 순서 데이터
 * @returns {Promise<void>}
 */
export async function reorderCategories(orders) {
  return fetchAuthApi('/admin/schedule-categories-order', {
    method: 'PUT',
    body: JSON.stringify({ orders }),
  });
}
