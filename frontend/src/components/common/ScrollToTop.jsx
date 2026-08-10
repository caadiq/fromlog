import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 페이지 이동 시 스크롤을 맨 위로 이동시키는 컴포넌트
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // window 스크롤 초기화
    window.scrollTo(0, 0);

    // 모바일 레이아웃 스크롤 컨테이너 초기화
    const mobileContent = document.querySelector('.mobile-content');
    if (mobileContent) {
      mobileContent.scrollTop = 0;
    }

    // PC 레이아웃 스크롤 컨테이너 초기화
    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

export default ScrollToTop;
