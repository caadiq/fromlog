import { ExternalLink, Play } from 'lucide-react';
import { decodeHtmlEntities, Fact, formatFactDate } from './utils';

/**
 * 예능 섹션 — 에디토리얼 (D_final_variety_mobile 시안)
 */
function MobileVarietySection({ schedule }) {
  const hasThumbnail = !!schedule.thumbnailUrl;
  const hasReplayUrl = !!schedule.replayUrl;
  const isYoutubeReplay = hasReplayUrl && /youtu\.?be/i.test(schedule.replayUrl);

  return (
    <div className="pb-16">
      {/* 썸네일 */}
      {hasThumbnail && (
        <div className="px-16 pt-[26px]">
          <img
            src={schedule.thumbnailUrl}
            alt={schedule.title}
            className="block w-full shadow-[0_20px_48px_rgba(20,22,19,0.2)]"
          />
        </div>
      )}

      <div className="px-[22px] pt-[22px]">
        {/* 제목 */}
        <h1
          className="text-[22px] font-extrabold leading-[1.4] tracking-[-0.5px] text-ink"
          style={{ textWrap: 'balance' }}
        >
          {decodeHtmlEntities(schedule.title)}
        </h1>

        {/* 팩트 시트 */}
        <div className="mt-5 border-t-2 border-ink">
          <Fact k="DATE">{formatFactDate(schedule.date, schedule.time)}</Fact>
          {schedule.broadcaster && <Fact k="BROADCAST">{schedule.broadcaster}</Fact>}
        </div>

        {/* 다시보기 */}
        {hasReplayUrl && (
          <a
            href={schedule.replayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 bg-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white"
          >
            {isYoutubeReplay ? <Play size={12} fill="currentColor" /> : <ExternalLink size={12} />}
            {schedule.broadcaster ? `${schedule.broadcaster}에서 다시보기` : '다시보기'}
          </a>
        )}
      </div>
    </div>
  );
}

export default MobileVarietySection;
