/**
 * 콘서트 정보 섹션 — 에디토리얼 리뉴얼
 * - 공연명
 * - 포스터
 */
import { Image } from 'lucide-react';
import PosterAddButton from '@/components/pc/admin/schedule/PosterAddButton';
import { F } from '@/components/pc/admin';

function ConcertInfoSection({ title, setTitle, posterPreview, onPosterChange, onPosterRemove }) {
  return (
    <div>
      <div className={F.section}>CONCERT INFO</div>
      <div className="mt-[22px] space-y-[26px]">
        {/* 공연명 */}
        <div>
          <label className={F.label}>공연명 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${F.underline} mt-1.5`}
          />
        </div>

        {/* 포스터 */}
        <div>
          <label className={F.label}>포스터</label>
          <div className="mt-2.5 flex items-start gap-6">
            <PosterAddButton scheduleTitle={title} maxCount={1} onAdd={(items) => onPosterChange(items[0].file)} className={`${F.dropzone} h-56 w-40 overflow-hidden`}>
              {posterPreview ? <img src={posterPreview} alt="포스터 미리보기" className="h-full w-full object-cover" /> : <><Image size={22} className="text-faint" /><span className="text-[13px]">포스터 추가</span></>}
            </PosterAddButton>
            <div className="flex-1 pt-1">
              <p className="text-[13px] leading-relaxed text-mute">
                권장: 세로형 포스터 (예: 700x1000px)
                <br />
                JPG · PNG · WebP
              </p>
              {posterPreview && (
                <button
                  type="button"
                  onClick={onPosterRemove}
                  className="mt-3 text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
                >
                  이미지 제거
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConcertInfoSection;
