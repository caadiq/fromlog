/**
 * 관리자 통계 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 대시보드 통계 조회
 * @returns {Promise<object>}
 */
export async function getStats() {
  return fetchAuthApi('/stats');
}
