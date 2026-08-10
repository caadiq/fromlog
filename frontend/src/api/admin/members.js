/**
 * 관리자 멤버 API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/**
 * 멤버 목록 조회
 * @returns {Promise<Array>}
 */
export async function getMembers() {
  return fetchAuthApi('/members');
}

/**
 * 멤버 상세 조회
 * @param {number} id - 멤버 ID
 * @returns {Promise<object>}
 */
export async function getMember(id) {
  return fetchAuthApi(`/members/${id}`);
}

/**
 * 멤버 수정
 * @param {number} id - 멤버 ID
 * @param {FormData} formData - 멤버 데이터
 * @returns {Promise<object>}
 */
export async function updateMember(id, formData) {
  return fetchFormData(`/members/${id}`, formData, 'PUT');
}
