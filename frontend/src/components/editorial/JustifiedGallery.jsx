/**
 * 에디토리얼 justified 갤러리 (공용) — 행 높이 통일 + 행 단위 가상 스크롤
 * 사용처: 멤버 갤러리, 앨범 컨셉 포토 갤러리
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/** justified 행 구성 — 목표 높이 기준으로 사진을 행에 채움 */
export function buildJustifiedRows(photos, containerWidth = 1160, targetHeight = 340, gap = 16) {
  const rows = [];
  let row = [];
  let rowRatio = 0;
  photos.forEach((p) => {
    const ratio = p.width && p.height ? p.width / p.height : 0.8;
    row.push({ ...p, ratio });
    rowRatio += ratio;
    if (rowRatio * targetHeight >= containerWidth - gap * (row.length - 1)) {
      const height = (containerWidth - gap * (row.length - 1)) / rowRatio;
      rows.push({ items: row, height });
      row = [];
      rowRatio = 0;
    }
  });
  if (row.length) {
    rows.push({
      items: row,
      height: Math.min(targetHeight, (containerWidth - gap * (row.length - 1)) / rowRatio),
    });
  }
  return rows;
}

/**
 * @param {Object[]} photos - { id, medium_url, thumb_url, width, height, caption? }
 * @param {Function} onPhotoClick - (photo, flatIndex) => void
 * @param {number} targetHeight - 행 목표 높이 (기본 340, 모바일은 작게)
 * @param {number} gap - 사진 간격
 * @param {string} scrollerSelector - 가상화 스크롤러 (기본 OverlayScrollbars viewport)
 */
export function JustifiedGallery({
  photos,
  onPhotoClick,
  rowGap = 16,
  targetHeight = 340,
  gap = 16,
  scrollerSelector = '[data-overlayscrollbars-viewport]',
}) {
  // 컨테이너 실제 폭 측정 (PC 1160 고정 대신 반응형)
  const listRef = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const measure = () => setWidth(listRef.current?.offsetWidth || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const rows = useMemo(
    () => (width ? buildJustifiedRows(photos, width, targetHeight, gap) : []),
    [photos, width, targetHeight, gap]
  );
  const flatIndex = (photo) => photos.findIndex((p) => p.id === photo.id);

  // 페이지 스크롤러 기준 행 가상화
  const [scrollEl, setScrollEl] = useState(null);
  useEffect(() => {
    setScrollEl(document.querySelector(scrollerSelector) || document.documentElement);
  }, [scrollerSelector]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => rows[i].height + rowGap,
    overscan: 4,
  });

  return (
    <div ref={listRef}>
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
          return (
            <div
              key={vi.key}
              className="absolute left-0 top-0 flex"
              style={{ transform: `translateY(${vi.start}px)`, gap }}
            >
              {row.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPhotoClick(p, flatIndex(p))}
                  className="group relative block shrink-0 overflow-hidden text-left transition-all duration-300 hover:z-10 hover:scale-[1.05] hover:shadow-xl"
                  style={{ width: row.height * p.ratio, height: row.height }}
                >
                  <img
                    src={p.medium_url || p.thumb_url}
                    alt=""
                    className="block h-full w-full object-cover"
                    style={{ filter: 'saturate(1.02)' }}
                    loading="lazy"
                  />
                  {p.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-extrabold tracking-k15 text-white">
                        {p.caption}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
