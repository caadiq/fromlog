/**
 * 관리자 팬사인회 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 팬사인회 생성
 * @param {object} data - { title, date, time, format, venue, members }
 */
export async function createFansign(data) {
  return fetchAuthApi('/admin/fansign', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 팬사인회 수정
 */
export async function updateFansign(id, data) {
  return fetchAuthApi(`/admin/fansign/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
