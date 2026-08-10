/**
 * 콘서트 정보 섹션 — 에디토리얼 리뉴얼
 * - 공연명
 * - 포스터
 */
import { useRef } from 'react';
import { Image } from 'lucide-react';
import { F } from '@/components/pc/admin';

function ConcertInfoSection({ title, setTitle, posterPreview, onPosterChange, onPosterRemove }) {
  const posterInputRef = useRef(null);

  const handlePosterChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onPosterChange(file);
    }
  };

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
            placeholder="예: fromis_9 WORLD TOUR NOW TOMORROW."
            className={`${F.underline} mt-1.5`}
          />
        </div>

        {/* 포스터 */}
        <div>
          <label className={F.label}>포스터</label>
          <div className="mt-2.5 flex items-start gap-6">
            <button
              type="button"
              onClick={() => posterInputRef.current?.click()}
              className={`${F.dropzone} h-56 w-40 overflow-hidden`}
            >
              {posterPreview ? (
                <img src={posterPreview} alt="포스터 미리보기" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Image size={22} className="text-faint" />
                  <span className="text-[13px]">클릭하여 업로드</span>
                </>
              )}
            </button>
            <input
              ref={posterInputRef}
              type="file"
              accept="image/*"
              onChange={handlePosterChange}
              className="hidden"
            />
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
