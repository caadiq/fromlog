/**
 * 관리자 인증 API
 */
import { fetchApi, fetchAuthApi } from '@/api/client';

/**
 * 로그인
 * @param {string} username - 사용자명
 * @param {string} password - 비밀번호
 * @returns {Promise<{token: string, user: object}>}
 */
export async function login(username, password) {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/**
 * 토큰 검증
 * @returns {Promise<{valid: boolean, user: object}>}
 */
export async function verifyToken() {
  return fetchAuthApi('/auth/verify');
}

/**
 * 비밀번호 변경
 * @param {string} currentPassword - 현재 비밀번호
 * @param {string} newPassword - 새 비밀번호
 */
export async function changePassword(currentPassword, newPassword) {
  return fetchAuthApi('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
