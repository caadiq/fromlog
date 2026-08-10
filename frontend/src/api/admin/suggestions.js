/**
 * 관리자 추천 검색어 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 사전 내용 조회
 * @returns {Promise<{content: string}>}
 */
export async function getDict() {
  return fetchAuthApi('/schedules/suggestions/dict');
}

/**
 * 사전 저장
 * @param {string} content - 사전 내용
 * @returns {Promise<void>}
 */
export async function saveDict(content) {
  return fetchAuthApi('/schedules/suggestions/dict', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}
