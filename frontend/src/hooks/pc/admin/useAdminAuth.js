import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores';
import { fetchApi } from '@/api/client';

function useVerifiedSession() {
  const token = useAuthStore(state => state.token);
  const query = useQuery({
    queryKey: ['admin', 'auth', 'verify', token],
    queryFn: () => fetchApi('/auth/verify', { headers: { Authorization: `Bearer ${token}` } }),
    enabled: !!token,
    retry: false,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (query.error?.status === 401 && useAuthStore.getState().token === token) {
      useAuthStore.getState().logout();
    }
  }, [query.error, token]);
  return { ...query, token };
}

export function useAdminAuth(options = {}) {
  const { redirectTo = '/admin', required = true } = options;
  const navigate = useNavigate();
  const session = useVerifiedSession();
  useEffect(() => {
    if (required && !session.token) navigate(redirectTo, { replace: true });
  }, [session.token, required, navigate, redirectTo]);
  return {
    user: session.data?.user,
    isLoading: !!session.token && session.isPending,
    isAuthenticated: !!session.token && !!session.data?.valid && !session.isError,
    isError: session.isError,
    error: session.error,
    retry: session.refetch,
    isFetching: session.isFetching,
  };
}

export function useRedirectIfAuthenticated(redirectTo = '/admin/dashboard') {
  const navigate = useNavigate();
  const session = useVerifiedSession();
  useEffect(() => {
    if (session.token && session.data?.valid && !session.isError) navigate(redirectTo, { replace: true });
  }, [session.token, session.data, session.isError, navigate, redirectTo]);
  return {
    isLoading: !!session.token && session.isPending,
    isAuthenticated: !!session.token && !!session.data?.valid && !session.isError,
  };
}
