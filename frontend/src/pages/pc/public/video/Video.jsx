/**
 * PC 영상 페이지 — 에디토리얼 (B2 시안: 피처드 + 채널 섹션 + 쇼츠 세로 레일)
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks';
import { videoApi } from '@/api';
import { OutlineTitle, fadeUp, stagger, Reveal } from '@/components/editorial';
import { VideoDuration } from '@/components/common';
import { wideThumb, shortsThumb, onWideThumbError, onShortsThumbLoad, onShortsThumbError } from '@/utils';
import VideoTitle from './VideoTitle';

/**
 * 카테고리 표시 라벨 (한글)
 * official·sp는 단일 채널이라 API가 내려주는 실제 채널명을 우선 사용한다.
 * variety는 예능뿐 아니라 e스포츠·기타 출연까지 섞여 있어 '예능 · 기타'로,
 * music은 음방 무대뿐 아니라 직캠·STUDIO CHOOM·릴레이댄스·시상식까지 담아
 * '무대 · 퍼포먼스'로 표기. (본채널의 퍼포먼스 비디오는 채널 아카이브 우선이라 본채널에 남음)
 */
export const CATEGORY_META = {
  official: { ko: '본채널' },
  sp: { ko: '스프' },
  variety: { ko: '예능 · 기타' },
  music: { ko: '무대 · 퍼포먼스' },
};

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
export function VideoCard({ video, showChannel = true }) {
  return (
    <motion.a
      variants={fadeUp}
      href={videoUrl(video)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="relative aspect-video overflow-hidden bg-canvas-deep">
        <img
          src={wideThumb(video.videoId)}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={(e) => onWideThumbError(e, video.videoId)}
        />
        <VideoDuration seconds={video.duration} videoType={video.videoType} />
      </div>
      <VideoTitle
        title={video.title}
        className="mt-[11px] text-[14.5px] font-extrabold leading-[1.45] tracking-[-0.2px] text-ink"
      />
      <span className="mt-[5px] block text-[12.5px] font-semibold text-mute">
        {showChannel && video.channelName ? `${video.channelName} · ` : ''}
        {fmtShortDate(video.publishedAt)}
      </span>
    </motion.a>
  );
}

function Video() {
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
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px] pt-[52px]">
        {/* 타이틀 */}
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.span variants={fadeUp} className="block text-[13px] font-extrabold tracking-k2 text-mute">
            ARCHIVE
          </motion.span>
          <motion.div variants={fadeUp}>
            <OutlineTitle solid="VIDE" outline="OS" className="mt-[10px] text-[56px] tracking-[-2px]" />
          </motion.div>
        </motion.div>

        {/* 피처드 — 최신 영상 */}
        {featured ? (
          <Reveal>
            <a
              href={videoUrl(featured)}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-[30px] grid grid-cols-[1.6fr_1fr] border border-hairline bg-white transition-colors hover:border-ink"
            >
              <div className="relative aspect-video overflow-hidden bg-canvas-deep">
                <img
                  src={wideThumb(featured.videoId)}
                  alt={featured.title}
                  className="h-full w-full object-cover"
                  onError={(e) => onWideThumbError(e, featured.videoId)}
                />
                <VideoDuration seconds={featured.duration} videoType={featured.videoType} />
              </div>
              <div className="flex flex-col p-9">
                <span className="text-[11.5px] font-extrabold tracking-k2 text-primary">
                  LATEST{featured.channelName ? ` · ${featured.channelName.toUpperCase()}` : ''}
                </span>
                <VideoTitle
                  title={featured.title}
                  className="mt-3.5 text-[23px] font-extrabold leading-[1.4] tracking-[-0.5px]"
                />
                <span className="mt-auto text-[13.5px] font-semibold text-mute">
                  {featured.publishedAt?.slice(0, 10).replaceAll('-', '. ')}.
                </span>
              </div>
            </a>
          </Reveal>
        ) : (
          isLoading && <div className="mt-[30px] aspect-[2.9] animate-pulse bg-canvas" />
        )}

        {/* 카테고리 섹션 */}
        {Object.entries(CATEGORY_META).map(([cat, meta]) =>
          (sections[cat] || []).length > 0 ? (
            <div key={cat} className="mt-11">
              <Reveal className="flex items-baseline justify-between border-t-2 border-ink pb-[18px] pt-3.5">
                <b className="text-[16px] font-extrabold tracking-[-0.3px]">
                  {labels[cat] || meta.ko}
                  {counts[cat] ? (
                    <span className="ml-2 text-[13px] font-extrabold text-mute">{counts[cat]}</span>
                  ) : null}
                </b>
                <Link to={`/video/${cat}`} className="text-[13px] font-extrabold tracking-[0.5px] text-primary">
                  전체보기 →
                </Link>
              </Reveal>
              <Reveal className="grid grid-cols-4 gap-[22px]" variants={stagger}>
                {sections[cat].map((v) => (
                  <VideoCard key={v.videoId} video={v} showChannel={cat === 'music' || cat === 'variety'} />
                ))}
              </Reveal>
            </div>
          ) : null
        )}

        {/* 쇼츠 세로 레일 */}
        {shorts.length > 0 && (
          <div className="mt-11">
            <Reveal className="flex items-baseline justify-between border-t-2 border-ink pb-[18px] pt-3.5">
              <b className="text-[16px] font-extrabold tracking-[-0.3px]">
                SHORTS
                {counts.shorts ? (
                  <span className="ml-2 text-[13px] font-extrabold text-mute">{counts.shorts}</span>
                ) : null}
              </b>
              <Link to="/video/shorts" className="text-[13px] font-extrabold tracking-[0.5px] text-primary">
                전체보기 →
              </Link>
            </Reveal>
            <Reveal className="grid grid-cols-6 gap-4" variants={stagger}>
              {shorts.map((v) => (
                <motion.a
                  key={v.videoId}
                  variants={fadeUp}
                  href={videoUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="relative overflow-hidden bg-canvas-deep" style={{ aspectRatio: '9/16' }}>
                    <img
                      src={shortsThumb(v.videoId)}
                      alt={v.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      onError={(e) => onShortsThumbError(e, v.videoId)}
                      onLoad={(e) => onShortsThumbLoad(e, v.videoId)}
                    />
                  </div>
                  <VideoTitle
                    title={v.title}
                    className="mt-[9px] text-[13px] font-extrabold leading-[1.4] tracking-[-0.2px] text-ink"
                  />
                </motion.a>
              ))}
            </Reveal>
          </div>
        )}
      </div>
    </div>
  );
}

export default Video;
