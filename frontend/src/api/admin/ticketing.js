/**
 * 관리자 티켓팅 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 티켓팅 세트 생성 (선예매·일반예매 중 입력된 단계만)
 * @param {object} data - { eventName, vendor, ticketUrl, seriesId, presale, general, authStart, authEnd, authNote, postUrls }
 */
export async function createTicketing(data) {
  return fetchAuthApi('/admin/ticketing', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 티켓팅 단건 수정
 */
export async function updateTicketing(id, data) {
  return fetchAuthApi(`/admin/ticketing/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 연결 가능한 콘서트 시리즈 목록
 */
export async function getTicketingSeries() {
  return fetchAuthApi('/admin/ticketing/series');
}
