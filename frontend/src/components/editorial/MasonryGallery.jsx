/**
 * 에디토리얼 2열 masonry 갤러리 (모바일)
 * 높이 기반 균등 분배 + 원본 비율 + 컬럼별 가상 스크롤 (보이는 것만 렌더)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/** 사진을 2열로 균등 분배 (누적 높이 기준) */
function distribute(photos) {
  const left = [];
  const right = [];
  let leftH = 0;
  let rightH = 0;
  photos.forEach((photo, index) => {
    const ratio = photo.height && photo.width ? photo.height / photo.width : 1;
    if (leftH <= rightH) {
      left.push({ ...photo, originalIndex: index, ratio });
      leftH += ratio;
    } else {
      right.push({ ...photo, originalIndex: index, ratio });
      rightH += ratio;
    }
  });
  return [left, right];
}

function MasonryColumn({ items, colWidth, gap, scrollEl, onPhotoClick }) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => Math.round(colWidth * items[i].ratio) + (items[i].caption ? 20 : 0) + gap,
    overscan: 6,
  });

  return (
    <div className="relative min-w-0 flex-1" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((vi) => {
        const p = items[vi.index];
        return (
          <button
            key={p.id ?? p.originalIndex}
            type="button"
            onClick={() => onPhotoClick(p, p.originalIndex)}
            className="absolute left-0 block w-full"
            style={{ transform: `translateY(${vi.start}px)` }}
          >
            <img
              src={p.thumb_url || p.medium_url}
              alt=""
              loading="lazy"
              className="block w-full"
              style={{ filter: 'saturate(1.02)', aspectRatio: `1 / ${p.ratio}` }}
            />
            {p.caption && (
              <span className="block truncate px-px pt-[5px] text-left text-[12px] font-extrabold tracking-k1 text-mute">
                {p.caption}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * @param {Object[]} photos - { id, thumb_url, medium_url, width, height }
 * @param {Function} onPhotoClick - (photo, originalIndex) => void
 * @param {string} scrollerSelector - 가상화 스크롤러 (기본 모바일 콘텐츠 영역)
 */
export function MasonryGallery({ photos, onPhotoClick, gap = 3, scrollerSelector = '.mobile-content' }) {
  const columns = useMemo(() => distribute(photos), [photos]);

  // 스크롤러 + 컬럼 폭 측정
  const wrapRef = useRef(null);
  const [scrollEl, setScrollEl] = useState(null);
  const [colWidth, setColWidth] = useState(0);
  useEffect(() => {
    setScrollEl(document.querySelector(scrollerSelector) || document.documentElement);
    const measure = () => {
      const w = wrapRef.current?.offsetWidth || 0;
      setColWidth(w ? (w - gap) / 2 : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [scrollerSelector, gap]);

  return (
    <div ref={wrapRef} className="flex items-start" style={{ gap }}>
      {colWidth > 0 &&
        columns.map((column, ci) => (
          <MasonryColumn
            key={ci}
            items={column}
            colWidth={colWidth}
            gap={gap}
            scrollEl={scrollEl}
            onPhotoClick={onPhotoClick}
          />
        ))}
    </div>
  );
}
