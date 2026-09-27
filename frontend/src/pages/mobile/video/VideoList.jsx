/**
 * Mobile 영상 전체보기 — 필터 + 월 구분 그리드 + 무한 스크롤 (PC와 동일 규칙)
 * - music  : 채널 드롭다운 (음방사별)
 * - variety: 채널 드롭다운
 * - shorts : 세로 카드 3열
 * - 그 외  : 필터 없음 (쇼츠 제외)
 */
import { useMemo, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import ChannelSelect from '@/components/common/VideoChannelSelect';
import ContentState from '@/components/pc/public/ContentState';
import { useDocumentTitle } from '@/hooks';
import { videoApi } from '@/api';
import { fadeUp, stagger, Reveal } from '@/components/editorial';
import { CATEGORY_META } from '@/pages/pc/public/video/Video';
import { MobileVideoCard, MobileShortsCard } from './Video';

const PAGE_SIZE = 24;

function MobileVideoList() {
  const { category: rawCategory } = useParams();
  const isShorts = rawCategory === 'shorts';
  const isAll = rawCategory === 'all';
  const category = isShorts || isAll ? undefined : rawCategory;
  const meta = isShorts ? { ko: 'SHORTS' } : CATEGORY_META[category] || { ko: '전체' };
  useDocumentTitle(`영상 - ${meta.ko}`);

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
    shorts: isShorts ? 'only' : 'exclude',
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch, isFetchNextPageError } = useInfiniteQuery({
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

  // 무한 스크롤 — 모바일은 .mobile-content가 스크롤 컨테이너라 root로 지정해야 한다
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchNextPageError) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { root: el.closest('.mobile-content') || null, rootMargin: '600px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError]);

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
  const gridClass = isShorts ? 'grid grid-cols-3 gap-x-2.5 gap-y-4' : 'grid grid-cols-2 gap-x-3 gap-y-5';

  return (
    <div className="flex-1 bg-paper px-[22px] pb-16 pt-[26px] text-ink">
      {/* 크럼 + 타이틀 */}
      <motion.div initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp} className="flex items-baseline gap-2 text-[12px] font-extrabold tracking-k2">
          <Link to="/video" className="text-mute">VIDEOS</Link>
          <span className="text-faint">/</span>
          <span className="text-primary">{koLabel}</span>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-1.5 flex items-baseline gap-2">
          <h1 className="text-[28px] font-extrabold tracking-[-1px]">{koLabel}</h1>
          <span className="text-[13.5px] font-extrabold text-mute">{total}</span>
        </motion.div>
      </motion.div>

      {/* 필터 */}
      {hasFilter ? (
        <div className="relative z-20 mt-4 border-b border-hairline border-t-2 border-t-ink py-3.5">
          <ChannelSelect mobile channels={facets?.channels || []} value={channel} onChange={setChannel} />
        </div>
      ) : (
        <div className="mt-4 border-t-2 border-ink" />
      )}

      {/* 월 구분 그리드 */}
      {isLoading ? (
        <div className={`mt-6 ${gridClass}`}>
          {Array.from({ length: isShorts ? 9 : 6 }).map((_, i) => (
            <div key={i}>
              <div
                className={`animate-pulse bg-canvas ${isShorts ? '' : 'aspect-video'}`}
                style={isShorts ? { aspectRatio: '9/16' } : undefined}
              />
              <div className="mt-2 h-[12px] w-3/4 animate-pulse bg-canvas" />
            </div>
          ))}
        </div>
      ) : error && !videos.length ? (
        <ContentState onRetry={() => refetch()}>영상을 불러오지 못했습니다.</ContentState>
      ) : videos.length === 0 ? (
        <p className="py-20 text-center text-[13.5px] text-mute">조건에 맞는 영상이 없습니다.</p>
      ) : (
        groups.map((g) => (
          <div key={g.ym}>
            <div className="mb-3 mt-7 flex items-center gap-3">
              <b className="text-[13.5px] font-extrabold tracking-k1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {g.ym.replace('-', '. ')}
              </b>
              <span className="flex-1 border-t border-dashed border-faint-light" />
              <span className="text-[11.5px] font-bold text-mute">{monthCounts[g.ym] || g.videos.length}개</span>
            </div>
            <Reveal className={gridClass} variants={stagger}>
              {g.videos.map((v) =>
                isShorts ? (
                  <MobileShortsCard key={v.videoId} video={v} />
                ) : (
                  <MobileVideoCard
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

      {isFetchNextPageError && <ContentState onRetry={() => fetchNextPage()}>다음 영상을 불러오지 못했습니다.</ContentState>}
      <div ref={sentinelRef} className="h-px" />
      {isFetchingNextPage && (
        <p className="mt-8 text-center text-[12.5px] font-bold text-mute">불러오는 중...</p>
      )}
    </div>
  );
}

export default MobileVideoList;
