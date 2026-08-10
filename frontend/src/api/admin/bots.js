/**
 * 관리자 봇 관리 API
 */
import { fetchAuthApi } from '@/api/client';

/**
 * 봇 목록 조회
 * @returns {Promise<Array>}
 */
export async function getBots() {
  return fetchAuthApi('/admin/bots');
}

/**
 * YouTube 봇 상세 조회
 * @param {number} id - YouTube 봇 DB ID
 * @returns {Promise<object>}
 */
export async function getYouTubeBot(id) {
  return fetchAuthApi(`/admin/youtube-bots/${id}`);
}

/**
 * 채널 핸들로 채널 정보 조회
 * @param {string} handle - @username 형식
 * @returns {Promise<object>}
 */
export async function lookupChannel(handle) {
  return fetchAuthApi('/admin/youtube-bots/lookup', {
    method: 'POST',
    body: JSON.stringify({ handle }),
  });
}

/**
 * YouTube 봇 추가
 * @param {object} data - 봇 데이터
 * @returns {Promise<object>}
 */
export async function createYouTubeBot(data) {
  return fetchAuthApi('/admin/youtube-bots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * YouTube 봇 수정
 * @param {number} id - YouTube 봇 DB ID
 * @param {object} data - 업데이트할 데이터
 * @returns {Promise<object>}
 */
export async function updateYouTubeBot(id, data) {
  return fetchAuthApi(`/admin/youtube-bots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * YouTube 봇 삭제
 * @param {number} id - YouTube 봇 DB ID
 * @returns {Promise<object>}
 */
export async function deleteYouTubeBot(id) {
  return fetchAuthApi(`/admin/youtube-bots/${id}`, { method: 'DELETE' });
}

/**
 * X 봇 상세 조회
 * @param {number} id - X 봇 DB ID
 * @returns {Promise<object>}
 */
export async function getXBot(id) {
  return fetchAuthApi(`/admin/x-bots/${id}`);
}

/**
 * X username으로 프로필 정보 조회
 * @param {string} username - X username (@ 없이)
 * @returns {Promise<object>}
 */
export async function lookupXProfile(username) {
  return fetchAuthApi('/admin/x-bots/lookup', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

/**
 * X 봇 추가
 * @param {object} data - 봇 데이터
 * @returns {Promise<object>}
 */
export async function createXBot(data) {
  return fetchAuthApi('/admin/x-bots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * X 봇 수정
 * @param {number} id - X 봇 DB ID
 * @param {object} data - 업데이트할 데이터
 * @returns {Promise<object>}
 */
export async function updateXBot(id, data) {
  return fetchAuthApi(`/admin/x-bots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * X 봇 삭제
 * @param {number} id - X 봇 DB ID
 * @returns {Promise<object>}
 */
export async function deleteXBot(id) {
  return fetchAuthApi(`/admin/x-bots/${id}`, { method: 'DELETE' });
}

/**
 * 축제 봇 상세 조회
 * @param {number} id - 축제 봇 DB ID
 * @returns {Promise<object>}
 */
export async function getFestivalBot(id) {
  return fetchAuthApi(`/admin/festival-bots/${id}`);
}

/**
 * 축제 봇 추가
 * @param {object} data - 봇 데이터
 * @returns {Promise<object>}
 */
export async function createFestivalBot(data) {
  return fetchAuthApi('/admin/festival-bots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 축제 봇 수정
 * @param {number} id - 축제 봇 DB ID
 * @param {object} data - 업데이트할 데이터
 * @returns {Promise<object>}
 */
export async function updateFestivalBot(id, data) {
  return fetchAuthApi(`/admin/festival-bots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 축제 봇 삭제
 * @param {number} id - 축제 봇 DB ID
 * @returns {Promise<object>}
 */
export async function deleteFestivalBot(id) {
  return fetchAuthApi(`/admin/festival-bots/${id}`, { method: 'DELETE' });
}

/**
 * 봇 시작
 * @param {string} id - 봇 ID
 * @returns {Promise<object>}
 */
export async function startBot(id) {
  return fetchAuthApi(`/admin/bots/${id}/start`, { method: 'POST' });
}

/**
 * 봇 정지
 * @param {string} id - 봇 ID
 * @returns {Promise<object>}
 */
export async function stopBot(id) {
  return fetchAuthApi(`/admin/bots/${id}/stop`, { method: 'POST' });
}

/**
 * 봇 전체 동기화
 * @param {string} id - 봇 ID
 * @returns {Promise<object>}
 */
export async function syncAllVideos(id) {
  return fetchAuthApi(`/admin/bots/${id}/sync-all`, { method: 'POST' });
}

/**
 * 할당량 경고 조회
 * @returns {Promise<{warning: boolean, message: string}>}
 */
export async function getQuotaWarning() {
  return fetchAuthApi('/admin/bots/quota-warning');
}

/**
 * 할당량 경고 해제
 * @returns {Promise<void>}
 */
export async function dismissQuotaWarning() {
  return fetchAuthApi('/admin/bots/quota-warning', { method: 'DELETE' });
}
