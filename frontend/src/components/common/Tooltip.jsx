import { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 커스텀 툴팁 컴포넌트
 * 트리거 요소 위 중앙에 고정 표시
 * @param {React.ReactNode} children - 툴팁을 표시할 요소
 * @param {string|React.ReactNode} text - 툴팁에 표시할 내용 (content prop과 호환)
 * @param {string|React.ReactNode} content - 툴팁에 표시할 내용 (text prop과 호환)
 * @param {boolean} showOnlyOnOverflow - true면 내용이 잘렸을 때(overflow)만 툴팁 표시
 */
function Tooltip({ children, text, content, className = '', showOnlyOnOverflow = false }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ bottom: 0, left: 0 });
  const triggerRef = useRef(null);

  // text 또는 content prop 사용 (문자열 또는 React 노드)
  const tooltipContent = text || content;

  // x를 화면 안으로 클램프 (툴팁 최대 폭 480px + 여백 기준)
  const clampX = (x) => {
    const half = 240 + 16;
    return Math.min(Math.max(x, half), window.innerWidth - half);
  };

  const handleMouseEnter = () => {
    // 잘렸을 때만 표시 옵션: 트리거 내 지정 요소(또는 첫 자식)의 실제 폭이 넘치는지 검사
    if (showOnlyOnOverflow) {
      const el =
        triggerRef.current?.querySelector('[data-tooltip-overflow]') ||
        triggerRef.current?.firstElementChild ||
        triggerRef.current;
      if (el && el.scrollWidth <= el.clientWidth) return;
    }
    // 트리거 요소 위 중앙에 고정
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      bottom: window.innerHeight - rect.top + 8,
      left: clampX(rect.left + rect.width / 2),
    });
    setIsVisible(true);
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={className || 'inline-flex items-center'}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible &&
        tooltipContent &&
        ReactDOM.createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, x: '-50%', y: 5, scale: 0.95 }}
              animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
              exit={{ opacity: 0, x: '-50%', y: 5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                bottom: position.bottom,
                left: position.left,
              }}
              className="fixed z-[9999] max-w-[480px] bg-ink px-3.5 py-2 text-[14px] font-semibold leading-relaxed text-white shadow-[0_10px_30px_rgba(20,22,19,0.25)] pointer-events-none"
            >
              {tooltipContent}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
