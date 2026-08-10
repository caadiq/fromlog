/**
 * API 클라이언트
 * 모든 API 호출에서 사용되는 기본 fetch 래퍼
 */
import { useAuthStore } from '@/stores';

const API_BASE = '/api';

/**
 * API 에러 클래스
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * 응답 처리 헬퍼
 */
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '요청 실패' }));
    throw new ApiError(
      error.error || error.message || `HTTP ${response.status}`,
      response.status,
      error
    );
  }

  // 204 No Content 처리
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * 공개 API fetch
 * @param {string} endpoint - API 엔드포인트 (/api 제외)
 * @param {RequestInit} options - fetch 옵션
 */
export async function fetchApi(endpoint, options = {}) {
  const url = endpoint.startsWith('/api') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  // body가 있고 FormData가 아닐 때만 Content-Type 설정
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return handleResponse(response);
}

/**
 * 인증된 API fetch (토큰 자동 추가)
 * @param {string} endpoint - API 엔드포인트
 * @param {RequestInit} options - fetch 옵션
 */
export async function fetchAuthApi(endpoint, options = {}) {
  const token = useAuthStore.getState().token;

  if (!token) {
    throw new ApiError('인증이 필요합니다.', 401);
  }

  return fetchApi(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * FormData 전송용 (이미지 업로드 등)
 * @param {string} endpoint - API 엔드포인트
 * @param {FormData} formData - 전송할 FormData
 * @param {string} method - HTTP 메서드 (기본: POST)
 * @param {Object} options - 추가 옵션
 * @param {boolean} options.requireAuth - 인증 필수 여부 (기본: true)
 */
export async function fetchFormData(endpoint, formData, method = 'POST', { requireAuth = true } = {}) {
  const token = useAuthStore.getState().token;
  const url = endpoint.startsWith('/api') ? endpoint : `${API_BASE}${endpoint}`;

  if (requireAuth && !token) {
    throw new ApiError('인증이 필요합니다.', 401);
  }

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: formData,
  });

  return handleResponse(response);
}

/**
 * HTTP 메서드 헬퍼 생성기
 */
function createMethodHelpers(baseFetch) {
  return {
    get: (endpoint) => baseFetch(endpoint),
    post: (endpoint, data) =>
      baseFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    put: (endpoint, data) =>
      baseFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    del: (endpoint) => baseFetch(endpoint, { method: 'DELETE' }),
  };
}

/**
 * 공개 API 헬퍼
 * @example api.get('/albums'), api.post('/albums', data)
 */
export const api = createMethodHelpers(fetchApi);

/**
 * 인증 API 헬퍼
 * @example authApi.get('/admin/stats'), authApi.post('/admin/schedules', data)
 */
export const authApi = createMethodHelpers(fetchAuthApi);
