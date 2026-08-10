import { Clock } from 'lucide-react';
import { decodeHtmlEntities } from './utils';
import { OutlineButton } from '@/components/editorial';
import Crumb from './Crumb';

/** 제목 + 룰 + 채널명·채널 보기 */
function VideoInfo({ schedule, large = false }) {
  const channelName = schedule.channelName || schedule.source?.name;

  return (
    <div>
      <h1
        className={`border-b-2 border-ink pb-7 font-bold leading-[1.45] tracking-[-0.3px] text-ink ${
          large ? 'text-[27px]' : 'text-[24px]'
        }`}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>
      {channelName && (
        <div className="flex items-center justify-between border-b border-hairline py-5">
          <b className="text-[17px] font-bold">{channelName}</b>
          {schedule.channelUrl && (
            <a href={schedule.channelUrl} target="_blank" rel="noopener noreferrer">
              <OutlineButton>채널 보기 →</OutlineButton>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PC 유튜브 상세 — 에디토리얼 리뉴얼 (D_final_youtube_pc / D_final_youtube_shorts_pc 시안)
 * 롱폼: 상단 크럼 → 16:9 임베드 → 제목 → 채널행 (세로 흐름)
 * 숏츠: 좌 9:16 임베드 | 우 정보 (가로 스프레드)
 */
function YoutubeSection({ schedule }) {
  const videoId = schedule.videoId;
  const isShorts = schedule.videoType === 'shorts';
  const isScheduled = !videoId; // videoId가 없으면 업로드 예정

  // 숏츠: 좌 영상 | 우 정보
  if (!isScheduled && isShorts) {
    return (
      <div className="mx-auto grid w-full max-w-[1300px] flex-1 grid-cols-[1fr_1.15fr] px-[70px]">
        <div className="flex items-start justify-center border-r border-hairline pb-14 pr-14 pt-24">
          <div className="relative aspect-[9/16] w-full max-w-[440px] overflow-hidden bg-ink">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
              title={schedule.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col pb-14 pl-16 pt-24">
          <Crumb schedule={schedule} label={`${schedule.category?.name?.toUpperCase() || '유튜브'} · SHORTS`} />
          <div className="mt-7">
            <VideoInfo schedule={schedule} large />
          </div>
          <div className="mt-auto pt-14 text-[13px] font-extrabold tracking-k25 text-faint">
            SCHEDULE — SHORTS
          </div>
        </div>
      </div>
    );
  }

  // 롱폼 / 업로드 예정: 세로 흐름
  return (
    <div className="mx-auto w-full max-w-[960px] px-10 pb-[90px]">
      <div className="pt-12">
        <Crumb schedule={schedule} />
      </div>
      <div className="relative mt-5 aspect-video w-full overflow-hidden bg-ink">
        {isScheduled ? (
          <>
            {schedule.bannerUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-40"
                style={{ backgroundImage: `url(${schedule.bannerUrl})` }}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-7 text-white">
              <Clock size={18} className="text-[#F2C94C]" />
              <span className="text-[16.5px] font-bold tracking-[-0.2px]">업로드 예정</span>
            </div>
          </>
        ) : (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?rel=0`}
            title={schedule.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        )}
      </div>
      <div className="mt-9">
        <VideoInfo schedule={schedule} large />
      </div>
    </div>
  );
}

export default YoutubeSection;
