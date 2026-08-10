/**
 * AdminLayout 컴포넌트
 * 모든 Admin 페이지에서 공통으로 사용하는 레이아웃
 * 헤더 고정 + 본문 스크롤 구조
 */
import { useLocation } from 'react-router-dom';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useAuthStore } from '@/stores';
import Header from './Header';

const OS_OPTIONS = {
  scrollbars: { theme: 'os-theme-fromis', autoHide: 'leave', autoHideDelay: 600, clickScroll: 'instant' },
};
const OS_OPTIONS_X = {
  scrollbars: { theme: 'os-theme-fromis', autoHide: 'leave', autoHideDelay: 600, clickScroll: 'instant' },
  overflow: { y: 'hidden' },
};

function AdminLayout({ user, children }) {
  const location = useLocation();
  const { token } = useAuthStore();

  // 토큰이 없으면 아무것도 렌더링하지 않음 (useAdminAuth에서 리다이렉트 처리)
  if (!token) {
    return null;
  }

  // 일정 목록 페이지만 내부 스크롤 처리 (하위 페이지는 레이아웃 스크롤 사용)
  const isSchedulePage = location.pathname === '/admin/schedule';

  return (
    isSchedulePage ? (
      <OverlayScrollbarsComponent element="div" className="h-dvh" options={OS_OPTIONS_X}>
        <div className="min-w-[1100px] h-dvh flex flex-col bg-paper text-ink">
          <div className="sticky top-0 z-30"><Header user={user} /></div>
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </div>
      </OverlayScrollbarsComponent>
    ) : (
      <OverlayScrollbarsComponent element="div" className="h-dvh" options={OS_OPTIONS}>
        <div className="min-w-[1100px] min-h-dvh flex flex-col bg-paper text-ink">
          <div className="sticky top-0 z-30"><Header user={user} /></div>
          <main className="flex-1">{children}</main>
        </div>
      </OverlayScrollbarsComponent>
    )
  );
}

export default AdminLayout;
