import { Clock } from 'lucide-react';
import { decodeHtmlEntities, Fact, formatFactDate, useFullscreenOrientation } from './utils';

/**
 * 유튜브 섹션 — 에디토리얼 (D_final_youtube_mobile 시안)
 */
function MobileYoutubeSection({ schedule }) {
  const videoId = schedule.videoId;
  const isShorts = schedule.videoType === 'shorts';
  const isScheduled = !videoId; // videoId가 없으면 업로드 예정
  const channelName = schedule.channelName || schedule.source?.name;

  // 숏츠가 아닐 때만 가로 회전 (숏츠는 전체화면에서 세로 유지)
  useFullscreenOrientation(isShorts);

  return (
    <div className="pb-16">
      {/* 영상 임베드 / 업로드 예정 */}
      {isScheduled ? (
        <div className="relative aspect-video w-full overflow-hidden border-b border-hairline bg-ink">
          {schedule.bannerUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{ backgroundImage: `url(${schedule.bannerUrl})` }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-5 text-white">
            <Clock size={16} className="text-[#F2C94C]" />
            <span className="text-[15px] font-bold tracking-[-0.2px]">업로드 예정</span>
          </div>
        </div>
      ) : isShorts ? (
        <div className="flex justify-center border-b border-hairline bg-ink">
          <div className="relative aspect-[9/16] w-[64%] max-w-[260px]">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
              title={schedule.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : (
        <div className="relative aspect-video w-full overflow-hidden border-b border-hairline bg-ink">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?rel=0`}
            title={schedule.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
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

        {/* 채널 행 */}
        {channelName && (
          <div className="mt-4 flex items-center justify-between border-b border-hairline pb-[18px]">
            <b className="min-w-0 truncate text-[16px] font-extrabold">{channelName}</b>
            {schedule.channelUrl && (
              <a
                href={schedule.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 shrink-0 border border-ink px-3.5 py-[9px] text-[12.5px] font-extrabold tracking-k15 text-ink"
              >
                채널 →
              </a>
            )}
          </div>
        )}

        {/* 팩트 */}
        <div className={channelName ? '' : 'mt-4 border-t border-hairline'}>
          <Fact k="DATE">{formatFactDate(schedule.date, schedule.time)}</Fact>
        </div>
      </div>
    </div>
  );
}

export default MobileYoutubeSection;
