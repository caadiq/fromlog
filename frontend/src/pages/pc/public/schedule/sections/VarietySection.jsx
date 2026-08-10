import { Tv, ExternalLink, Play } from 'lucide-react';
import { decodeHtmlEntities } from './utils';
import Crumb from './Crumb';

/**
 * PC 예능 상세 — 에디토리얼 리뉴얼 (D_final_variety_pc 시안)
 * 좌 세로 썸네일 | 우 크럼·제목·팩트시트(방송사)·다시보기
 */
function VarietySection({ schedule }) {
  const hasThumbnail = !!schedule.thumbnailUrl;
  const hasReplayUrl = !!schedule.replayUrl;
  const isYoutubeReplay = hasReplayUrl && /youtu\.?be/i.test(schedule.replayUrl);
  const categoryColor = schedule.category?.color || '#06b6d4';

  return (
    <div className="mx-auto grid w-full max-w-[1300px] flex-1 grid-cols-[1fr_1.05fr] px-[70px]">
      {/* 썸네일 */}
      <div className="flex items-start justify-center border-r border-hairline px-16 pb-16 pt-[52px]">
        {hasThumbnail ? (
          <img
            src={schedule.thumbnailUrl}
            alt={schedule.title}
            className="block w-full max-w-[430px] shadow-[0_30px_70px_rgba(20,22,19,0.22)]"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full max-w-[430px] items-center justify-center bg-canvas-deep">
            <Tv size={48} className="text-faint" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex min-w-0 flex-col pb-14 pl-16 pt-[52px]">
        <Crumb schedule={schedule} color={categoryColor} />
        <h1
          className="mt-[26px] text-[34px] font-extrabold leading-[1.35] tracking-[-0.9px] text-ink"
          style={{ textWrap: 'balance' }}
        >
          {decodeHtmlEntities(schedule.title)}
        </h1>

        {/* 팩트 시트 */}
        {schedule.broadcaster && (
          <div className="mt-8 border-t-2 border-ink">
            <div className="grid grid-cols-[120px_1fr] items-baseline border-b border-hairline px-0.5 py-[15px]">
              <span className="text-[13px] font-extrabold tracking-k25 text-mute">BROADCAST</span>
              <span className="text-[16.5px] font-semibold leading-[1.6] text-ink">{schedule.broadcaster}</span>
            </div>
          </div>
        )}

        {/* 다시보기 */}
        {hasReplayUrl && (
          <div className="mt-[26px] flex">
            <a
              href={schedule.replayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-ink px-[26px] py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
            >
              {isYoutubeReplay ? <Play size={13} fill="currentColor" /> : <ExternalLink size={13} />}
              {schedule.broadcaster ? `${schedule.broadcaster}에서 다시보기` : '다시보기'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default VarietySection;
