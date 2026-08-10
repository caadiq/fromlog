/**
 * 관리자 수집 큐(검토 대기) API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/** 대기 목록 */
export async function getPending() {
  return fetchAuthApi('/admin/pending');
}

/** 대기 건수 (배지용) */
export async function getPendingCount() {
  return fetchAuthApi('/admin/pending/count');
}

/**
 * 검토 후 등록 (수정된 값으로)
 * @param {FormData} formData - payload(JSON) + poster 파일들
 */
export async function registerPending(id, formData) {
  return fetchFormData(`/admin/pending/${id}/register`, formData, 'POST');
}

/** 무시 */
export async function dismissPending(id) {
  return fetchAuthApi(`/admin/pending/${id}/dismiss`, { method: 'POST' });
}
