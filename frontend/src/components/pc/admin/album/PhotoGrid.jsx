/**
 * 사진/티저 그리드 컴포넌트 — 에디토리얼 리뉴얼
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Image, Check } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Array} props.items - 사진/티저 목록
 * @param {Array} props.selectedItems - 선택된 아이템 ID 목록
 * @param {Function} props.onToggleSelect - 선택 토글 핸들러
 * @param {'concept'|'teaser'} props.type - 그리드 타입
 */
const PhotoGrid = memo(function PhotoGrid({ items, selectedItems, onToggleSelect, type }) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <Image className="mx-auto mb-4 text-faint" size={40} />
        <p className="text-[14.5px] text-mute">
          등록된 {type === 'concept' ? '컨셉 포토' : '티저 이미지'}가 없습니다
        </p>
        <p className="mt-1 text-[13.5px] text-faint">
          업로드 탭에서 {type === 'concept' ? '사진' : '티저'}을 추가하세요
        </p>
      </div>
    );
  }

  if (type === 'concept') {
    return (
      <div className="grid grid-cols-6 gap-2.5">
        {items.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index < 20 ? index * 0.02 : 0 }}
            className={`group relative aspect-square cursor-pointer overflow-hidden border transition-all duration-200 ${
              selectedItems.includes(photo.id)
                ? 'border-ink shadow-[inset_0_0_0_1.5px_#141613]'
                : 'border-hairline hover:border-ink'
            }`}
            onClick={() => onToggleSelect(photo.id)}
          >
            <img
              src={photo.thumb_url || photo.medium_url}
              alt={`사진 ${photo.sort_order}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />

            <div
              className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center transition-all ${
                selectedItems.includes(photo.id)
                  ? 'bg-ink'
                  : 'bg-white/85 opacity-0 group-hover:opacity-100'
              }`}
            >
              {selectedItems.includes(photo.id) && <Check size={14} className="text-white" />}
            </div>

            <div
              className="absolute right-2 top-2 bg-ink/70 px-1.5 py-0.5 text-[12px] font-extrabold text-white"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {String(photo.sort_order).padStart(2, '0')}
            </div>

            {photo.concept_name && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <span className="block truncate text-[13px] font-bold text-white">
                  {photo.concept_name}
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  }

  // Teaser grid
  return (
    <div className="grid grid-cols-6 gap-2.5">
      {items.map((teaser, index) => {
        const teaserId = `teaser-${teaser.id}`;
        return (
          <motion.div
            key={teaser.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index < 20 ? index * 0.02 : 0 }}
            className={`group relative aspect-square cursor-pointer overflow-hidden border transition-all duration-200 ${
              selectedItems.includes(teaserId)
                ? 'border-ink shadow-[inset_0_0_0_1.5px_#141613]'
                : 'border-hairline hover:border-ink'
            }`}
            onClick={() => onToggleSelect(teaserId)}
          >
            {teaser.media_type === 'video' ? (
              <video
                src={teaser.video_url || teaser.original_url}
                poster={teaser.thumb_url}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                muted
                loop
                onMouseEnter={(e) => e.target.play()}
                onMouseLeave={(e) => {
                  e.target.pause();
                  e.target.currentTime = 0;
                }}
              />
            ) : (
              <img
                src={teaser.thumb_url || teaser.medium_url}
                alt={`티저 ${teaser.sort_order}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
            )}

            <div
              className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center transition-all ${
                selectedItems.includes(teaserId)
                  ? 'bg-ink'
                  : 'bg-white/85 opacity-0 group-hover:opacity-100'
              }`}
            >
              {selectedItems.includes(teaserId) && <Check size={14} className="text-white" />}
            </div>

            <div
              className="absolute right-2 top-2 bg-ink/70 px-1.5 py-0.5 text-[12px] font-extrabold text-white"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {String(teaser.sort_order).padStart(2, '0')}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
});

export default PhotoGrid;
