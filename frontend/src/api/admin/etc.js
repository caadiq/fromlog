/**
 * 관리자 기타(공용) 일정 API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/**
 * 기타 상세 조회 (수정 폼용)
 */
export async function getEtc(id) {
  return fetchAuthApi(`/admin/etc/${id}`);
}

/**
 * 기타 생성
 * @param {FormData} formData - payload(JSON) + poster 파일들
 */
export async function createEtc(formData) {
  return fetchFormData('/admin/etc', formData, 'POST');
}

/**
 * 기타 수정
 */
export async function updateEtc(id, formData) {
  return fetchFormData(`/admin/etc/${id}`, formData, 'PUT');
}

/**
 * 기타 삭제
 */
export async function deleteEtc(id) {
  return fetchAuthApi(`/admin/etc/${id}`, { method: 'DELETE' });
}
