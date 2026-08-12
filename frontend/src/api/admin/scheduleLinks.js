/**
 * 관리자 - 일정 고정 링크 API
 */
import { fetchAuthApi } from '@/api/client';

/** 전체 목록 (만료·예정 포함) */
export async function getScheduleLinks() {
  return fetchAuthApi('/admin/schedule-links');
}

/** 추가 */
export async function createScheduleLink(data) {
  return fetchAuthApi('/admin/schedule-links', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** 수정 */
export async function updateScheduleLink(id, data) {
  return fetchAuthApi(`/admin/schedule-links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** 삭제 */
export async function deleteScheduleLink(id) {
  return fetchAuthApi(`/admin/schedule-links/${id}`, { method: 'DELETE' });
}

/** 드래그로 바뀐 순서 저장 (배열 순서가 곧 노출 순서) */
export async function reorderScheduleLinks(ids) {
  return fetchAuthApi('/admin/schedule-links/order', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}
