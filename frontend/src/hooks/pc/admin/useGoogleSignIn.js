/**
 * 구글 로그인 버튼 훅 (Google Identity Services)
 *
 * 서버에서 사용 가능 여부·클라이언트 ID를 받아온 뒤 GIS 스크립트를 한 번만 붙이고,
 * 지정한 컨테이너에 구글 버튼을 그린다. 버튼을 누르면 구글이 ID 토큰을 주고,
 * 그 토큰을 서버로 보내 우리 JWT로 교환한다.
 *
 * 설정이 안 돼 있으면(googleEnabled=false) 아무것도 그리지 않는다 —
 * 비밀번호 로그인만으로도 들어갈 수 있어야 하기 때문.
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as authApi from '@/api/admin/auth';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** GIS 스크립트를 한 번만 로드 (이미 있으면 재사용) */
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useGoogleSignIn({ onSuccess }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['auth', 'config'],
    queryFn: authApi.getAuthConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const enabled = Boolean(config?.googleEnabled && config?.googleClientId);

  useEffect(() => {
    if (!enabled || !buttonRef.current) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (response) => {
            setPending(true);
            setError('');
            try {
              const data = await authApi.loginWithGoogle(response.credential);
              onSuccess(data);
            } catch (e) {
              setError(e?.message || '구글 로그인에 실패했습니다.');
            } finally {
              setPending(false);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 380,
        });
      })
      .catch(() => {
        if (!cancelled) setError('구글 로그인을 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, config?.googleClientId, onSuccess]);

  return { buttonRef, enabled, error, pending };
}
