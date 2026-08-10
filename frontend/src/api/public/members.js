/**
 * 멤버 API
 */
import { fetchApi, fetchAuthApi, fetchFormData } from '@/api/client';

// ==================== 공개 API ====================

/**
 * 멤버 목록 조회
 */
export async function getMembers() {
  return fetchApi('/members');
}

/**
 * 멤버 상세 조회
 */
export async function getMember(id) {
  return fetchApi(`/members/${id}`);
}

// ==================== 어드민 API ====================

/**
 * [Admin] 멤버 수정
 */
export async function updateMember(id, formData) {
  return fetchFormData(`/admin/members/${id}`, formData, 'PUT');
}

