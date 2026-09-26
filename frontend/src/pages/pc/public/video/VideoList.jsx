/**
 * PC 영상 전체보기 — 에디토리얼 (필터 + 월 구분 그리드 + 무한 스크롤)
 *
 * 카테고리별 필터
 * - music  : 채널 드롭다운 (음방사별로 보는 게 유용)
 * - variety: 채널 드롭다운 (채널이 60개가 넘어 칩으로는 화면을 잠식함)
 * - shorts : 필터 없음, 세로(9:16) 카드
 * - 그 외  : 필터 없음
 *
 * 쇼츠는 별도 카테고리로 분리돼 있으므로 일반 목록에서는 항상 제외한다.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useDocumentTitle, useClickOutside } from '@/hooks';
import { videoApi } from '@/api';
import { fadeUp, stagger, Reveal } from '@/components/editorial';
import { CATEGORY_META, VideoCard, videoUrl } from './Video';
import VideoTitle from './VideoTitle';
import VideoThumbnail from './VideoThumbnail';
import ContentState from '@/components/pc/public/ContentState';

const PAGE_SIZE = 24;

/** 쇼츠 세로 카드 (9:16) */
function ShortsCard({ video }) {
  return (
    <motion.a
      variants={fadeUp}
      href={videoUrl(video)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block min-w-0 break-words"
    >
      <div className="relative overflow-hidden bg-canvas-deep" style={{ aspectRatio: '9/16' }}>
        <VideoThumbnail video={video} shorts
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <VideoTitle
        title={video.title}
        className="mt-[9px] text-[13px] font-extrabold leading-[1.4] tracking-[-0.2px] text-ink"
      />
      <span className="mt-[4px] line-clamp-2 text-[13px] font-semibold text-mute">{video.channelName}</span>
    </motion.a>
  );
}

/** 채널 선택 드롭다운 (기타 카테고리) */
function ChannelSelect({ channels, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const reduced = useReducedMotion();
  const [placement, setPlacement] = useState({ maxHeight: 380, above: false });
  const close = () => { setOpen(false); buttonRef.current?.focus({ preventScroll: true }); };
  const menuKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') setOpen(false);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const nodes = [...menuRef.current.querySelectorAll('button')];
      const index = nodes.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + nodes.length) % nodes.length;
      nodes[next]?.focus();
    }
  };
  useEffect(() => {
    if (!open) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const headerBottom = document.querySelector('.pc-public header')?.getBoundingClientRect().bottom || 0;
    const above = rect.top - Math.max(12, headerBottom + 8) - 4;
    const dropAbove = below < Math.min(380, above);
    setPlacement({ maxHeight: Math.max(0, Math.min(380, dropAbove ? above : below)), above: dropAbove });
    const frame = requestAnimationFrame(() => (menuRef.current?.querySelector('[aria-selected="true"]') || menuRef.current?.querySelector('button'))?.focus({ preventScroll: true }));
    const dismiss = event => {
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); };
  }, [open]);

  useClickOutside(ref, () => setOpen(false), open);

  const current = channels.find((c) => c.name === value);

  return (
    <div ref={ref} className="relative z-20">
      <button
        type="button"
        ref={buttonRef} aria-haspopup="listbox" aria-expanded={open}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
          if (event.key === 'Escape' && open) { event.preventDefault(); close(); }
        }}
        onClick={() => setOpen((v) => !v)}
        className="flex w-[320px] max-w-full items-center justify-between gap-3 border border-hairline bg-white px-4 py-2.5 text-[13.5px] font-extrabold text-ink transition-colors hover:border-ink"
      >
        <span className="min-w-0 truncate">
          {current ? `${current.name} (${current.count})` : '전체 채널'}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-mute transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
      {open && (
        <motion.div ref={menuRef} role="listbox" aria-label="채널" onKeyDown={menuKey}
          initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -6 }} transition={{ duration: reduced ? 0 : 0.15 }}
          style={{ maxHeight: placement.maxHeight, ...(placement.above ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }) }}
          className="absolute left-0 z-20 w-full overflow-y-auto border border-ink bg-white shadow-[0_24px_60px_rgba(20,22,19,0.16)]">
          <button
            type="button"
            role="option" aria-selected={!value}
            onClick={() => { onChange(''); close(); }}
            className={`w-full px-4 py-2.5 text-left text-[13.5px] font-bold transition-colors hover:bg-canvas ${
              !value ? 'bg-canvas text-ink' : 'text-esub'
            }`}
          >
            전체 채널
          </button>
          {channels.map((c) => (
            <button
              key={c.name}
              type="button"
              role="option" aria-selected={value === c.name}
              onClick={() => { onChange(c.name); close(); }}
              className={`flex w-full items-center justify-between gap-3 border-t border-hairline px-4 py-2.5 text-left text-[13.5px] font-bold transition-colors hover:bg-canvas ${
                value === c.name ? 'bg-canvas text-ink' : 'text-esub'
              }`}
            >
              <span className="min-w-0 truncate">{c.name}</span>
              <span className="shrink-0 text-[12px] text-mute">{c.count}</span>
            </button>
          ))}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function VideoList() {
  const { category: rawCategory } = useParams();
  const isShorts = rawCategory === 'shorts';
  const isAll = rawCategory === 'all';
  const category = isShorts || isAll ? undefined : rawCategory;
  const meta = isShorts ? { ko: 'SHORTS' } : CATEGORY_META[category] || { ko: '전체' };
  useDocumentTitle(`영상 - ${meta.ko}`);

  // 필터 상태
  const [params, setParams] = useSearchParams();
  const channel = params.get('channel') || '';
  const setChannel = value => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (value) next.set('channel', value);
    else next.delete('channel');
    return next;
  });

  const baseParams = {
    ...(category ? { category } : {}),
    ...(channel ? { channel } : {}),
    // 쇼츠는 전용 페이지에서만 노출, 일반 목록에서는 항상 제외
    shorts: isShorts ? 'only' : 'exclude',
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, isFetchNextPageError, refetch } = useInfiniteQuery({
    queryKey: ['videos', baseParams],
    queryFn: ({ pageParam = 0 }) => videoApi.getVideos({ ...baseParams, offset: pageParam }),
    getNextPageParam: (last) => (last.hasMore ? last.offset + last.limit : undefined),
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
  });

  const pages = data?.pages || [];
  const videos = pages.flatMap((p) => p.videos);
  const total = pages[0]?.total || 0;
  const facets = pages[0]?.facets;
  const koLabel = isShorts ? 'SHORTS' : pages[0]?.categoryLabel || meta.ko;
  const monthCounts = useMemo(
    () => Object.fromEntries((pages[0]?.months || []).map((m) => [m.ym, m.count])),
    [pages]
  );

  // 무한 스크롤 — 하단 센티널이 보이면 다음 페이지 요청
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchNextPageError) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError]);

  // 월 구분 그룹핑
  const groups = useMemo(() => {
    const list = [];
    let current = null;
    for (const v of videos) {
      const ym = v.publishedAt?.slice(0, 7) || '';
      if (!current || current.ym !== ym) {
        current = { ym, videos: [] };
        list.push(current);
      }
      current.videos.push(v);
    }
    return list;
  }, [videos]);

  const hasFilter = category === 'music' || category === 'variety' || isShorts;
  const gridClass = isShorts ? 'grid grid-cols-6 gap-[26px_16px]' : 'grid grid-cols-4 gap-[26px_22px]';

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px] pt-[52px]">
        {/* 크럼 + 타이틀 */}
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp} className="flex items-baseline gap-2.5 text-[13px] font-extrabold tracking-k2">
            <Link to="/video" className="text-mute transition-colors hover:text-ink">VIDEOS</Link>
            <span className="text-faint">/</span>
            <span className="text-primary">{koLabel}</span>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-[10px] flex items-baseline gap-3">
            <h1 className="text-[42px] font-extrabold tracking-[-1.5px] text-ink">{koLabel}</h1>
            <span className="text-[16px] font-extrabold text-mute">{total}</span>
          </motion.div>
        </motion.div>

        {/* 필터 */}
        {hasFilter ? (
          <Reveal className="relative z-20 mt-6 flex flex-wrap items-center gap-2 border-b border-hairline border-t-2 border-t-ink px-0.5 py-4">
            <ChannelSelect channels={facets?.channels || []} value={channel} onChange={setChannel} />
          </Reveal>
        ) : (
          <div className="mt-6 border-t-2 border-ink" />
        )}

        {/* 월 구분 그리드 */}
        {isLoading ? (
          <div className={`mt-8 ${gridClass}`}>
            {Array.from({ length: isShorts ? 12 : 8 }).map((_, i) => (
              <div key={i}>
                <div
                  className={`animate-pulse bg-canvas ${isShorts ? '' : 'aspect-video'}`}
                  style={isShorts ? { aspectRatio: '9/16' } : undefined}
                />
                <div className="mt-3 h-[14px] w-3/4 animate-pulse bg-canvas" />
              </div>
            ))}
          </div>
        ) : error && !videos.length ? (
          <ContentState onRetry={() => refetch()}>영상을 불러오지 못했습니다.</ContentState>
        ) : videos.length === 0 ? (
          <p className="py-24 text-center text-[14.5px] text-mute">조건에 맞는 영상이 없습니다.</p>
        ) : (
          groups.map((g) => (
            <div key={g.ym}>
              <div className="mb-4 mt-9 flex items-center gap-3.5">
                <b className="text-[15px] font-extrabold tracking-k1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {g.ym.replace('-', '. ')}
                </b>
                <span className="flex-1 border-t border-dashed border-faint-light" />
                <span className="text-[12px] font-bold tracking-k1 text-mute">
                  {monthCounts[g.ym] || g.videos.length}개
                </span>
              </div>
              <Reveal className={gridClass} variants={stagger}>
                {g.videos.map((v) =>
                  isShorts ? (
                    <ShortsCard key={v.videoId} video={v} />
                  ) : (
                    <VideoCard
                      key={v.videoId}
                      video={v}
                      showChannel={!category || category === 'music' || category === 'variety'}
                    />
                  )
                )}
              </Reveal>
            </div>
          ))
        )}

        {isFetchNextPageError && (
          <ContentState onRetry={() => fetchNextPage()}>다음 영상을 불러오지 못했습니다.</ContentState>
        )}
        {/* 무한 스크롤 센티널 */}
        <div ref={sentinelRef} className="h-px" />
        {isFetchingNextPage && (
          <p className="mt-10 text-center text-[13px] font-bold tracking-k1 text-mute">불러오는 중...</p>
        )}
      </div>
    </div>
  );
}

export default VideoList;
