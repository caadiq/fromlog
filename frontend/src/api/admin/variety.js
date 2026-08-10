/**
 * 예능 관리자 API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/**
 * 예능 일정 생성
 */
export async function createVarietySchedule(formData) {
  return fetchFormData('/admin/variety/schedule', formData, 'POST');
}

/**
 * 예능 일정 상세 조회
 */
export async function getVarietySchedule(id) {
  return fetchAuthApi(`/admin/variety/schedule/${id}`);
}

/**
 * 예능 일정 수정
 */
export async function updateVarietySchedule(id, formData) {
  return fetchFormData(`/admin/variety/schedule/${id}`, formData, 'PUT');
}

/**
 * 자주 사용된 방송사/플랫폼 목록
 */
export async function getBroadcasters() {
  return fetchAuthApi('/admin/variety/broadcasters');
}
