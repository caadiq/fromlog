import { memo } from 'react';

/**
 * 라이트박스 인디케이터 컴포넌트
 * 이미지 갤러리에서 현재 위치를 표시하는 슬라이딩 점 인디케이터
 * CSS transition 사용으로 GPU 가속
 */
const LightboxIndicator = memo(function LightboxIndicator({
  count,
  currentIndex,
  goToIndex,
  width = 200,
}) {
  const halfWidth = width / 2;
  const translateX = -(currentIndex * 18) + halfWidth - 6;

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* 양옆 페이드 그라데이션 */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,1) 0%, transparent 20%, transparent 80%, rgba(0,0,0,1) 100%)',
        }}
      />
      {/* 슬라이딩 컨테이너 - CSS transition으로 GPU 가속 */}
      <div
        className="flex items-center gap-2 justify-center"
        style={{
          width: `${count * 18}px`,
          transform: `translateX(${translateX}px)`,
          transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            aria-label={`이미지 ${i + 1}/${count}`}
            aria-current={i === currentIndex ? 'true' : undefined}
            className={`rounded-full flex-shrink-0 transition-all duration-300 ${
              i === currentIndex
                ? 'w-3 h-3 bg-white'
                : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/60'
            }`}
            onClick={() => goToIndex(i)}
          />
        ))}
      </div>
    </div>
  );
});

export default LightboxIndicator;
