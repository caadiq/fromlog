import { useState, useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';

// 공통 컴포넌트
import { ScrollToTop } from '@/components/common';

// 라우트
import { PCPublicRoutes, PCAdminRoutes, MobileRoutes } from '@/routes';

// 스토어
import { useAuthStore } from '@/stores';

/**
 * PC/모바일은 **뷰포트 폭(matchMedia)** 하나로 판정한다. UA는 보지 않는다.
 *
 * - ~1099px: 모바일 레이아웃 (폰, 폰 가로, 태블릿 세로)
 * - 1100px~: PC 레이아웃 (데스크톱, 태블릿 가로)
 *
 * 1100 경계는 갤럭시탭 가로가 DPR 때문에 CSS 폭 1100대로 잡히기 때문이다
 * (1280 경계면 태블릿 가로가 모바일로 떨어진다). PC Layout의 min-w도 함께 1100.
 * matchMedia를 쓰는 이유: 개발자 도구 기기 에뮬레이션에서 innerWidth 갱신이나
 * resize 이벤트가 누락돼도 CSS 미디어쿼리는 토글 즉시 재평가된다.
 * (이전에는 react-device-detect(UA) → 로드 시 굳는 값이라 전환이 안 되고,
 *  태블릿은 별도 분기가 필요했다)
 */
const pcMq = window.matchMedia('(min-width: 1100px)');

function useIsPC() {
  const [isPC, setIsPC] = useState(() => pcMq.matches);
  useEffect(() => {
    const update = () => setIsPC(pcMq.matches);
    pcMq.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      pcMq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return isPC;
}

/**
 * PC 환경에서 body에 클래스 추가하는 래퍼
 */
function PCWrapper({ children }) {
  useEffect(() => {
    document.body.classList.add('is-pc');
    return () => document.body.classList.remove('is-pc');
  }, []);
  return children;
}

/**
 * PC 라우트 - admin 경로일 때만 AdminRoutes 렌더링
 */
function PCRoutes() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const { _hasHydrated } = useAuthStore();

  // admin 경로에서 hydration 완료 전까지 빈 화면
  if (isAdminPath && !_hasHydrated) {
    return null;
  }

  return (
    <PCWrapper>
      {isAdminPath ? <PCAdminRoutes /> : <PCPublicRoutes />}
    </PCWrapper>
  );
}

/**
 * Mobile 라우트 - admin 경로는 PC 관리자 페이지를 그대로 사용 (모바일 전용 관리자 삭제됨)
 */
function MobileRoutesEntry() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const { _hasHydrated } = useAuthStore();

  // admin 경로에서 hydration 완료 전까지 빈 화면
  if (isAdminPath && !_hasHydrated) {
    return null;
  }

  if (isAdminPath) {
    return (
      <PCWrapper>
        <PCAdminRoutes />
      </PCWrapper>
    );
  }
  return <MobileRoutes />;
}

/** 뷰포트 폭으로 PC/모바일 라우트를 고른다 */
function DeviceRoutes() {
  return useIsPC() ? <PCRoutes /> : <MobileRoutesEntry />;
}

/**
 * 프로미스나인 팬사이트 메인 앱
 * 뷰포트 폭(1100px) 기준 PC/Mobile 분리 — 태블릿은 가로=PC, 세로=모바일
 */
function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <DeviceRoutes />
    </BrowserRouter>
  );
}

export default App;
