/**
 * 앨범 트랙 입력 컴포넌트 — 에디토리얼 리뉴얼 (design-drafts/ADM_album_form 시안)
 */
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { CustomSelect } from '../common';

const VIDEO_TYPE_OPTIONS = [
  { value: '', label: '선택' },
  { value: 'music_video', label: '뮤직비디오' },
  { value: 'special', label: '스페셜 영상' },
];

const underline =
  'w-full border-b-2 border-ink bg-transparent px-0.5 pb-2 pt-1.5 text-[15px] font-bold text-ink placeholder-faint outline-none';
const label = 'block text-[12px] font-extrabold tracking-k2 text-mute';

/**
 * @param {Object} props
 * @param {Object} props.track - 트랙 데이터
 * @param {number} props.index - 트랙 인덱스
 * @param {Function} props.onUpdate - 트랙 업데이트 핸들러 (index, field, value)
 * @param {Function} props.onRemove - 트랙 삭제 핸들러 ()
 */
const TrackItem = memo(function TrackItem({ track, index, onUpdate, onRemove }) {
  return (
    <div className="border border-hairline bg-white px-[22px] pb-5 pt-[18px]">
      {/* 헤더: 트랙 번호 + 타이틀 토글 + 삭제 */}
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-extrabold tracking-k2 text-mute">
          TRACK {String(track.track_number).padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={() => onUpdate(index, 'is_title_track', !track.is_title_track)}
          className={`px-2 py-[3px] text-[12px] font-extrabold tracking-k1 transition-colors ${
            track.is_title_track
              ? 'bg-primary text-white'
              : 'border border-hairline text-mute hover:border-ink hover:text-ink'
          }`}
        >
          TITLE
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
        >
          삭제
        </button>
      </div>

      {/* 곡 제목 / 재생시간 */}
      <div className="mt-4 grid grid-cols-[3fr_1fr] gap-5">
        <div>
          <label className={label}>곡 제목</label>
          <input
            type="text"
            value={track.title}
            onChange={(e) => onUpdate(index, 'title', e.target.value)}
            className={`${underline} mt-1`}
            placeholder="곡 제목 입력"
          />
        </div>
        <div>
          <label className={label}>재생시간</label>
          <input
            type="text"
            value={track.duration || ''}
            onChange={(e) => onUpdate(index, 'duration', e.target.value)}
            className={`${underline} mt-1`}
            placeholder="0:00"
          />
        </div>
      </div>

      {/* 상세 정보 토글 */}
      <button
        type="button"
        onClick={() => onUpdate(index, 'showDetails', !track.showDetails)}
        className="mt-3.5 flex items-center gap-1 text-[13px] font-bold text-mute transition-colors hover:text-ink"
      >
        <ChevronDown
          size={13}
          className={`transition-transform ${track.showDetails ? 'rotate-180' : ''}`}
        />
        상세 정보 {track.showDetails ? '접기' : '펼치기'}
      </button>

      <AnimatePresence>
        {track.showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* 작사/작곡/편곡 */}
            <div className="mt-4 grid grid-cols-3 gap-5">
              {[
                { field: 'lyricist', name: '작사' },
                { field: 'composer', name: '작곡' },
                { field: 'arranger', name: '편곡' },
              ].map(({ field, name }) => (
                <div key={field}>
                  <label className={label}>{name}</label>
                  <input
                    type="text"
                    value={track[field] || ''}
                    onChange={(e) => onUpdate(index, field, e.target.value)}
                    className={`${underline} mt-1 text-[14.5px]`}
                    placeholder="쉼표로 구분"
                  />
                </div>
              ))}
            </div>

            {/* 비디오 URL */}
            <div className="mt-5">
              <label className={label}>영상 URL</label>
              <div className="mt-1 flex items-end gap-3">
                <input
                  type="text"
                  value={track.video_url || ''}
                  onChange={(e) => onUpdate(index, 'video_url', e.target.value)}
                  className={`${underline} text-[14.5px]`}
                  placeholder="https://youtube.com/watch?v=..."
                />
                <CustomSelect
                  value={track.video_type || ''}
                  onChange={(value) => onUpdate(index, 'video_type', value)}
                  options={VIDEO_TYPE_OPTIONS}
                  placeholder="선택"
                  size="sm"
                  className="w-32 shrink-0"
                />
              </div>
            </div>

            {/* 가사 */}
            <div className="mt-5">
              <label className={label}>가사</label>
              <textarea
                value={track.lyrics || ''}
                onChange={(e) => onUpdate(index, 'lyrics', e.target.value)}
                rows={12}
                className="mt-1.5 min-h-[200px] w-full resize-none border border-hairline bg-paper px-3.5 py-3 text-[14.5px] leading-relaxed text-ink placeholder-faint outline-none transition-colors focus:border-ink"
                placeholder="가사를 입력하세요..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default TrackItem;
