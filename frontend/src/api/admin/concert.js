/**
 * 콘서트 관리자 API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/**
 * 콘서트 일정 생성
 */
export async function createConcertSchedule(formData) {
  return fetchFormData('/admin/concert/schedule', formData, 'POST');
}

/**
 * 콘서트 시리즈 상세 조회 (수정 폼용)
 */
export async function getConcertSchedule(seriesId) {
  return fetchAuthApi(`/admin/concert/schedule/${seriesId}`);
}

/**
 * 콘서트 일정 수정
 */
export async function updateConcertSchedule(seriesId, formData) {
  return fetchFormData(`/admin/concert/schedule/${seriesId}`, formData, 'PUT');
}
