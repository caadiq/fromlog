/**
 * 일정 페이지 고정 링크 (공개)
 * 노출 기간에 걸린 것만 내려온다.
 */
import { fetchApi } from '@/api/client';

export async function getScheduleLinks() {
  return fetchApi('/schedule-links');
}
