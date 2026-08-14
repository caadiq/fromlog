/**
 * Mobile 영상 페이지 — 에디토리얼 (PC B2 구조를 모바일 폭에 맞춰 정합)
 * 피처드(세로 배치) + 카테고리 섹션(2열) + SHORTS 가로 스크롤 레일
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks';
import { videoApi } from '@/api';
import { OutlineTitle, fadeUp, stagger, Reveal } from '@/components/editorial';
import { CATEGORY_META } from '@/pages/pc/public/video/Video';
import { VideoDuration } from '@/components/common';
import { wideThumb, shortsThumb, onWideThumbError, onWideThumbLoad, onShortsThumbLoad, onShortsThumbError } from '@/utils';

/** 영상 링크 (쇼츠는 쇼츠 URL) */
export function videoUrl(v) {
  return v.videoType === 'shorts'
    ? `https://www.youtube.com/shorts/${v.videoId}`
    : `https://www.youtube.com/watch?v=${v.videoId}`;
}

/** 'YYYY-MM-DD HH:mm' → 'M. D.' */
export function fmtShortDate(publishedAt) {
  if (!publishedAt) return '';
  const [y, m, d] = publishedAt.slice(0, 10).split('-').map(Number);
  const now = new Date();
  return y !== now.getFullYear() ? `${y}. ${m}. ${d}.` : `${m}. ${d}.`;
}

/** 일반 영상 카드 (16:9) */
export function MobileVideoCard({ video, showChannel = true }) {
  return (
    <motion.a
      variants={fadeUp}
      href={videoUrl(video)}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <div className="relative aspect-video overflow-hidden bg-canvas-deep">
        <img
          src={wideThumb(video.videoId)}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => onWideThumbError(e, video.videoId)}
          onLoad={(e) => onWideThumbLoad(e, video.videoId)}
        />
        <VideoDuration seconds={video.duration} videoType={video.videoType} bgClass="bg-ink/65" className="text-[12px]" />
      </div>
      <b className="mt-2 line-clamp-2 text-[13.5px] font-extrabold leading-[1.4] tracking-[-0.2px] text-ink">
        {video.title}
      </b>
      <span className="mt-1 block text-[11.5px] font-semibold text-mute">
        {showChannel && video.channelName ? `${video.channelName} · ` : ''}
        {fmtShortDate(video.publishedAt)}
      </span>
    </motion.a>
  );
}

/** 쇼츠 세로 카드 (9:16) */
export function MobileShortsCard({ video, className = '' }) {
  return (
    <a
      href={videoUrl(video)}
      target="_blank"
      rel="noopener noreferrer"
      className={`block ${className}`}
    >
      <div className="relative overflow-hidden bg-canvas-deep" style={{ aspectRatio: '9/16' }}>
        <img
          src={shortsThumb(video.videoId)}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => onShortsThumbError(e, video.videoId)}
          onLoad={(e) => onShortsThumbLoad(e, video.videoId)}
        />
      </div>
      <b className="mt-1.5 line-clamp-2 text-[12px] font-extrabold leading-[1.35] tracking-[-0.2px] text-ink">
        {video.title}
      </b>
    </a>
  );
}

function MobileVideo() {
  useDocumentTitle('영상');

  const { data, isLoading } = useQuery({
    queryKey: ['videosHome'],
    queryFn: videoApi.getVideosHome,
    staleTime: 5 * 60 * 1000,
  });

  const featured = data?.featured;
  const sections = data?.sections || {};
  const shorts = data?.shorts || [];
  const counts = data?.counts || {};
  const labels = data?.labels || {};

  return (
    <div className="flex-1 bg-paper px-[22px] pb-16 pt-[26px] text-ink">
      {/* 타이틀 */}
      <motion.div initial="hidden" animate="show" variants={stagger}>
        <motion.span variants={fadeUp} className="block text-[12px] font-extrabold tracking-k2 text-mute">
          ARCHIVE
        </motion.span>
        <motion.div variants={fadeUp}>
          {/* PC와 동일한 아웃라인 포인트 — leading-none이라 라벨과의 간격도 좁아진다 */}
          <OutlineTitle solid="VIDE" outline="OS" className="mt-1 text-[32px] tracking-[-1.2px]" />
        </motion.div>
      </motion.div>

      {/* 피처드 */}
      {featured ? (
        <Reveal>
          <a
            href={videoUrl(featured)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block border border-hairline bg-white"
          >
            <div className="relative aspect-video overflow-hidden bg-canvas-deep">
              <img
                src={wideThumb(featured.videoId)}
                alt={featured.title}
                className="h-full w-full object-cover"
                onError={(e) => onWideThumbError(e, featured.videoId)}
                onLoad={(e) => onWideThumbLoad(e, featured.videoId)}
              />
              <VideoDuration seconds={featured.duration} videoType={featured.videoType} bgClass="bg-ink/65" className="text-[12px]" />
            </div>
            <div className="p-4">
              <span className="text-[10.5px] font-extrabold tracking-k2 text-primary">
                LATEST{featured.channelName ? ` · ${featured.channelName.toUpperCase()}` : ''}
              </span>
              <b className="mt-2 line-clamp-2 text-[16px] font-extrabold leading-[1.4] tracking-[-0.3px]">
                {featured.title}
              </b>
              <span className="mt-2 block text-[12px] font-semibold text-mute">
                {featured.publishedAt?.slice(0, 10).replaceAll('-', '. ')}.
              </span>
            </div>
          </a>
        </Reveal>
      ) : (
        isLoading && <div className="mt-5 aspect-video animate-pulse bg-canvas" />
      )}

      {/* 카테고리 섹션 (2열) */}
      {Object.entries(CATEGORY_META).map(([cat, meta]) =>
        (sections[cat] || []).length > 0 ? (
          <div key={cat} className="mt-9">
            <Reveal className="flex items-baseline justify-between border-t-2 border-ink pb-3.5 pt-3">
              <b className="text-[14.5px] font-extrabold tracking-[-0.3px]">
                {labels[cat] || meta.ko}
                {counts[cat] ? (
                  <span className="ml-1.5 text-[12px] font-extrabold text-mute">{counts[cat]}</span>
                ) : null}
              </b>
              <Link to={`/video/${cat}`} className="text-[12px] font-extrabold tracking-[0.5px] text-primary">
                전체보기 →
              </Link>
            </Reveal>
            <Reveal className="grid grid-cols-2 gap-x-3 gap-y-5" variants={stagger}>
              {sections[cat].slice(0, 4).map((v) => (
                <MobileVideoCard key={v.videoId} video={v} showChannel={cat === 'music' || cat === 'variety'} />
              ))}
            </Reveal>
          </div>
        ) : null
      )}

      {/* SHORTS — 가로 스크롤 레일 */}
      {shorts.length > 0 && (
        <div className="mt-9">
          <Reveal className="flex items-baseline justify-between border-t-2 border-ink pb-3.5 pt-3">
            <b className="text-[14.5px] font-extrabold tracking-[-0.3px]">
              SHORTS
              {counts.shorts ? (
                <span className="ml-1.5 text-[12px] font-extrabold text-mute">{counts.shorts}</span>
              ) : null}
            </b>
            <Link to="/video/shorts" className="text-[12px] font-extrabold tracking-[0.5px] text-primary">
              전체보기 →
            </Link>
          </Reveal>
          {/* 화면 밖까지 밀리는 레일 — 단, 스크롤 처음·끝 멈춤 위치는 섹션 보더(22px)와 정렬 */}
          <div className="-mx-[22px] overflow-x-auto px-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3">
              {shorts.map((v) => (
                <MobileShortsCard key={v.videoId} video={v} className="w-[124px] flex-none" />
              ))}
              {/* 끝 여백 — overflow 컨테이너의 padding-right는 무시되므로 스페이서로 채운다.
                  flex gap 12px + 10px = 22px (위 보더 여백과 일치) */}
              <div className="w-[10px] flex-none" aria-hidden="true" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileVideo;
