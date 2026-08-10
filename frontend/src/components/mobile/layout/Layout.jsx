import { useEffect } from 'react';
import MobileHeader from './Header';
import MobileBottomNav from './BottomNav';
import '@/mobile.css';

/**
 * 모바일 레이아웃 컴포넌트
 * @param {React.ReactNode} children - 페이지 컨텐츠
 * @param {string} pageTitle - 헤더에 표시할 제목 (없으면 fromis_9)
 * @param {boolean} hideHeader - true면 헤더 숨김 (일정 페이지처럼 자체 헤더가 있는 경우)
 * @param {boolean} useCustomLayout - true면 자체 레이아웃 사용
 * @param {boolean} noShadow - 헤더 그림자 숨김
 */
function MobileLayout({
  children,
  pageTitle,
  hideHeader = false,
  useCustomLayout = false,
  noShadow = false,
  showBack = false,
}) {
  // 모바일 레이아웃 활성화 (body 스크롤 방지)
  useEffect(() => {
    document.documentElement.classList.add('mobile-layout');
    return () => {
      document.documentElement.classList.remove('mobile-layout');
    };
  }, []);

  // 자체 레이아웃 사용 시 (Schedule 페이지 등)
  if (useCustomLayout) {
    return (
      <div className="mobile-layout-container bg-paper">
        {children}
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="mobile-layout-container bg-paper">
      {!hideHeader && <MobileHeader title={pageTitle} noShadow={noShadow} showBack={showBack} />}
      <main className="mobile-content">{children}</main>
      <MobileBottomNav />
    </div>
  );
}

export default MobileLayout;
