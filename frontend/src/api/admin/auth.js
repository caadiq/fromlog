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
 * 로그인 화면용 공개 설정 (구글 로그인 사용 가능 여부·클라이언트 ID)
 * @returns {Promise<{googleEnabled: boolean, googleClientId: string}>}
 */
export async function getAuthConfig() {
  return fetchApi('/auth/config');
}

/**
 * 구글 계정으로 로그인
 * @param {string} credential - 구글이 발급한 ID 토큰
 * @returns {Promise<{token: string, user: object}>}
 */
export async function loginWithGoogle(credential) {
  return fetchApi('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
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
