import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import Header from './Header';
import Footer from './Footer';
import '@/pc.css';

// 페이지 오버레이 스크롤바 옵션 — 화면을 밀지 않고 뷰포트 끝에 고정
const OS_OPTIONS = {
  scrollbars: { theme: 'os-theme-fromis', autoHide: 'leave', autoHideDelay: 600, clickScroll: 'instant' },
};
/**
 * PC 레이아웃 컴포넌트
 */
function Layout({ children }) {
  const location = useLocation();

  // 페이지 이동 시 스크롤 맨 위로 (OverlayScrollbars 내부 스크롤은 라우트가 바뀌어도 유지되므로)
  useEffect(() => {
    document.querySelector('[data-overlayscrollbars-viewport]')?.scrollTo(0, 0);
  }, [location.pathname]);

  // Footer는 홈에서만 표시
  const showFooter = location.pathname === '/';

  // 헤더 + 본문을 하나의 가로 스크롤(min-w-1100) 안에 넣어, 1100 미만이면
  // 헤더까지 함께 가로 스크롤됨(줄바꿈 방지). 헤더는 sticky top-0이라 세로 스크롤 시 고정.
  return (
    // 가로+세로 오버레이 스크롤. 세로바는 뷰포트 끝에 항상 보임.
    <OverlayScrollbarsComponent element="div" className="h-dvh" options={OS_OPTIONS}>
      <div className="min-w-[1100px] min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col">
          <motion.div
            key={location.pathname}
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
          {showFooter && <Footer />}
        </main>
      </div>
    </OverlayScrollbarsComponent>
  );
}

export default Layout;
