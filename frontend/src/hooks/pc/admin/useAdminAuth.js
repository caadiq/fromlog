import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores';
import { authApi } from '@/api';

/**
 * 어드민 인증 훅
 * 토큰 유효성 검증 및 미인증 시 리다이렉트
 * @param {object} options - 옵션
 * @param {string} options.redirectTo - 미인증 시 리다이렉트 경로 (기본: /admin)
 * @param {boolean} options.required - 인증 필수 여부 (기본: true)
 */
export function useAdminAuth(options = {}) {
  const { redirectTo = '/admin', required = true } = options;
  const navigate = useNavigate();
  const { token, user, logout, isAuthenticated } = useAuthStore();

  // logout 함수를 ref로 안정화하여 무한 루프 방지
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  // 토큰 검증 쿼리 - 고유 queryKey 사용
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'auth', 'verify'],
    queryFn: authApi.verifyToken,
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  // 토큰 검증 실패 시 (토큰 만료 등) 로그아웃 후 리다이렉트
  // 참고: 토큰이 없는 경우는 라우트 가드(RequireAuth)에서 처리
  useEffect(() => {
    if (required && isError) {
      logoutRef.current();
      navigate(redirectTo, { replace: true });
    }
  }, [isError, required, navigate, redirectTo]);

  return {
    user: data?.user || user,
    isLoading: !token ? false : isLoading,
    isAuthenticated: !!data?.valid || isAuthenticated,
    isError,
  };
}

/**
 * 로그인 페이지에서 사용하는 훅
 * 이미 인증된 경우 리다이렉트
 * @param {string} redirectTo - 인증된 경우 리다이렉트 경로
 */
export function useRedirectIfAuthenticated(redirectTo = '/admin/dashboard') {
  const navigate = useNavigate();
  const { token } = useAuthStore();

  // 토큰 검증 - 고유 queryKey 사용
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth', 'redirect-check'],
    queryFn: authApi.verifyToken,
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    // token이 있고 검증이 성공한 경우에만 리다이렉트
    // 로그아웃 시 캐시된 data가 남아있어도 token이 없으면 리다이렉트하지 않음
    if (token && data?.valid) {
      navigate(redirectTo);
    }
  }, [token, data, navigate, redirectTo]);

  return {
    isLoading: !!token && isLoading,
    isAuthenticated: !!data?.valid,
  };
}
