/**
 * 관리자 행사 API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/**
 * 행사 상세 조회 (수정 폼용)
 */
export async function getEvent(id) {
  return fetchAuthApi(`/admin/events/${id}`);
}

/**
 * 행사 생성
 * @param {FormData} formData - payload(JSON) + poster 파일들
 */
export async function createEvent(formData) {
  return fetchFormData('/admin/events', formData, 'POST');
}

/**
 * 행사 수정
 */
export async function updateEvent(id, formData) {
  return fetchFormData(`/admin/events/${id}`, formData, 'PUT');
}

/**
 * 행사 삭제
 */
export async function deleteEvent(id) {
  return fetchAuthApi(`/admin/events/${id}`, { method: 'DELETE' });
}
