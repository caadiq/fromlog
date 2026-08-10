/**
 * NumberPicker 컴포넌트
 * 스크롤 가능한 숫자/값 선택 피커
 * AdminScheduleForm의 시간 선택에서 사용
 */
import { useState, useEffect, useRef } from 'react';

function NumberPicker({ items, value, onChange }) {
  const ITEM_HEIGHT = 40;
  const containerRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0); // 드래그용 ref
  const touchStartY = useRef(0);
  const startOffset = useRef(0);
  const isScrolling = useRef(false);

  // offset 변경시 ref도 업데이트
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // 초기 위치 설정
  useEffect(() => {
    if (value !== null && value !== undefined) {
      const index = items.indexOf(value);
      if (index !== -1) {
        const newOffset = -index * ITEM_HEIGHT;
        setOffset(newOffset);
        offsetRef.current = newOffset;
      }
    }
  }, []);

  // 값 변경시 위치 업데이트
  useEffect(() => {
    const index = items.indexOf(value);
    if (index !== -1) {
      const targetOffset = -index * ITEM_HEIGHT;
      if (Math.abs(offset - targetOffset) > 1) {
        setOffset(targetOffset);
        offsetRef.current = targetOffset;
      }
    }
  }, [value, items]);

  const centerOffset = ITEM_HEIGHT; // 중앙 위치 오프셋

  // 아이템이 중앙에 있는지 확인
  const isItemInCenter = (item) => {
    const itemIndex = items.indexOf(item);
    const itemPosition = -itemIndex * ITEM_HEIGHT;
    const tolerance = ITEM_HEIGHT / 2;
    return Math.abs(offset - itemPosition) < tolerance;
  };

  // 오프셋 업데이트 (경계 제한)
  const updateOffset = (newOffset) => {
    const maxOffset = 0;
    const minOffset = -(items.length - 1) * ITEM_HEIGHT;
    return Math.min(maxOffset, Math.max(minOffset, newOffset));
  };

  // 중앙 아이템 업데이트
  const updateCenterItem = (currentOffset) => {
    const centerIndex = Math.round(-currentOffset / ITEM_HEIGHT);
    if (centerIndex >= 0 && centerIndex < items.length) {
      const centerItem = items[centerIndex];
      if (value !== centerItem) {
        onChange(centerItem);
      }
    }
  };

  // 가장 가까운 아이템에 스냅
  const snapToClosestItem = (currentOffset) => {
    const targetOffset = Math.round(currentOffset / ITEM_HEIGHT) * ITEM_HEIGHT;
    setOffset(targetOffset);
    offsetRef.current = targetOffset;
    updateCenterItem(targetOffset);
  };

  // 터치 시작
  const handleTouchStart = (e) => {
    e.stopPropagation();
    touchStartY.current = e.touches[0].clientY;
    startOffset.current = offsetRef.current;
  };

  // 터치 이동
  const handleTouchMove = (e) => {
    e.stopPropagation();
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    const newOffset = updateOffset(startOffset.current + deltaY);
    setOffset(newOffset);
    offsetRef.current = newOffset;
  };

  // 터치 종료
  const handleTouchEnd = (e) => {
    e.stopPropagation();
    snapToClosestItem(offsetRef.current);
  };

  // 마우스 휠 - 바깥 스크롤 방지
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isScrolling.current) return;
    isScrolling.current = true;

    const newOffset = updateOffset(offsetRef.current - Math.sign(e.deltaY) * ITEM_HEIGHT);
    setOffset(newOffset);
    offsetRef.current = newOffset;
    snapToClosestItem(newOffset);

    setTimeout(() => {
      isScrolling.current = false;
    }, 50);
  };

  // 마우스 드래그
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    touchStartY.current = e.clientY;
    startOffset.current = offsetRef.current;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaY = moveEvent.clientY - touchStartY.current;
      const newOffset = updateOffset(startOffset.current + deltaY);
      setOffset(newOffset);
      offsetRef.current = newOffset;
    };

    const handleMouseUp = () => {
      snapToClosestItem(offsetRef.current);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // wheel 이벤트 passive false로 등록
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-16 h-[120px] overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* 중앙 선택 영역 */}
      <div className="absolute left-1 right-1 top-1/2 z-0 h-10 -translate-y-1/2 border-y-2 border-ink/80" />

      {/* 피커 내부 */}
      <div
        className="relative transition-transform duration-150 ease-out"
        style={{ transform: `translateY(${offset + centerOffset}px)` }}
      >
        {items.map((item) => (
          <div
            key={item}
            className={`h-10 leading-10 text-center select-none transition-all duration-150 ${
              isItemInCenter(item) ? 'text-[17px] font-extrabold text-ink' : 'text-[15px] text-faint'
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NumberPicker;
