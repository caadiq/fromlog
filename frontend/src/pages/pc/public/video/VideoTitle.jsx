/**
 * 영상 제목 — 2줄 클램프 + 커스텀 툴팁
 *
 * 브라우저 기본 title 툴팁은 표시가 느리고 스타일을 맞출 수 없어,
 * 실제로 잘린 제목에 한해 에디토리얼 톤의 툴팁을 직접 띄운다.
 * 카드가 grid/overflow 안에 있어 잘릴 수 있으므로 portal + fixed 배치.
 */
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

function VideoTitle({ title, className = '' }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null); // { x, y }

  const handleEnter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 잘리지 않은 제목이면 툴팁 불필요
    if (el.scrollHeight <= el.clientHeight + 1) return;
    const r = el.getBoundingClientRect();
    setTip({ x: r.left, y: r.bottom + 8 });
  }, []);

  const handleLeave = useCallback(() => setTip(null), []);

  return (
    <>
      <b
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`line-clamp-2 ${className}`}
      >
        {title}
      </b>
      {tip &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-[360px] border border-ink bg-ink px-3 py-2 text-[12.5px] font-semibold leading-[1.55] text-white shadow-[0_12px_30px_rgba(20,22,19,0.25)]"
            style={{
              left: Math.min(tip.x, window.innerWidth - 372),
              top: Math.min(tip.y, window.innerHeight - 80),
            }}
          >
            {title}
          </span>,
          document.body
        )}
    </>
  );
}

export default VideoTitle;
