import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAlbumByName } from '@/api';
import { calculateTotalDuration } from '@/utils';
import { MobileLightbox, Loading } from '@/components/common';
import { useDocumentTitle } from '@/hooks/common';
import { fadeUp, stagger, Reveal } from '@/components/editorial';
import { useDialogBackClose } from '@/hooks/common';

/**
 * 모바일 앨범 상세 — 에디토리얼 리뉴얼 (A_final_detail_mobile 시안)
 */
function MobileAlbumDetail() {
  const { name } = useParams();

  const { data: album, isLoading } = useQuery({
    queryKey: ['album', name],
    queryFn: () => getAlbumByName(name),
  });

  useDocumentTitle(album?.title);

  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, teasers: null, photos: null });
  const [showDescription, setShowDescription] = useState(false);
  // 뒤로가기 시 소개 모달만 닫기 (히스토리는 useDialogBackClose가 담당)
  useDialogBackClose(showDescription, () => setShowDescription(false));

  const openLightbox = useCallback((images, index, teasersMeta = null, photosMeta = null) => {
    setLightbox({ open: true, images, index, teasers: teasersMeta, photos: photosMeta });
  }, []);

  const openDescription = useCallback(() => {
    setShowDescription(true);
  }, []);
  const closeDescription = useCallback(() => {
    setShowDescription(false);
  }, []);

  const tracks = album?.tracks || [];
  const titleTrack = tracks.find((t) => t.is_title_track) || tracks[0];
  const totalDuration = useMemo(() => calculateTotalDuration(tracks), [tracks]);

  const conceptPhotos = useMemo(() => {
    const cp = album?.conceptPhotos;
    if (!cp) return [];
    // 컨셉명 포함 flat (라이트박스 정보 시트용)
    return Object.entries(cp).flatMap(([concept, list]) =>
      list.map((p) => ({ ...p, concept }))
    );
  }, [album]);

  const teasers = album?.teasers || [];

  if (isLoading) return <Loading />;
  if (!album) {
    return <div className="flex items-center justify-center py-40 text-mute">앨범을 찾을 수 없습니다</div>;
  }

  return (
    <>
      {/* 크럼 (고정) */}
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-paper px-3 py-2.5">
        <Link to="/album" className="p-2 text-esub active:text-ink" aria-label="앨범 목록으로">
          <ChevronLeft size={20} />
        </Link>
        <b className="min-w-0 truncate text-[13.5px] font-extrabold tracking-k25 text-mute">
          DISCOGRAPHY / {album.title}
        </b>
      </div>

      {/* 스크롤 영역 */}
      <div className="mobile-content bg-paper text-ink">
      {/* 커버 — 전폭 꽉 채움 */}
      <motion.div
        className="border-b border-hairline"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {album.cover_medium_url || album.cover_original_url ? (
          <button
            type="button"
            onClick={() => openLightbox([album.cover_original_url || album.cover_medium_url], 0)}
            className="block w-full"
          >
            <img
              src={album.cover_medium_url || album.cover_original_url}
              alt={album.title}
              className="block aspect-square w-full object-cover"
            />
          </button>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[44px] text-faint">
            ◉
          </div>
        )}
      </motion.div>

      {/* 정보 */}
      <motion.div className="px-[22px] pb-2 pt-[26px]" initial="hidden" animate="show" variants={stagger}>
        <motion.span variants={fadeUp} className="block text-[13px] font-extrabold tracking-k25 text-primary">
          {album.album_type}
        </motion.span>
        <motion.h1
          variants={fadeUp}
          className="mt-2 text-[38px] font-black leading-[1.05] tracking-[-1.5px]"
          style={{ textWrap: 'balance' }}
        >
          {album.title}
        </motion.h1>
        <motion.div variants={fadeUp} className="mt-[22px] border-t-2 border-ink">
          <div className="grid grid-cols-[104px_1fr] items-baseline border-b border-hairline px-0.5 py-3">
            <span className="text-[12px] font-extrabold tracking-k2 text-mute">RELEASE</span>
            <span className="text-[15px] font-semibold">
              {album.release_date?.slice(0, 10).replaceAll('-', '. ')}
            </span>
          </div>
          {titleTrack && (
            <div className="grid grid-cols-[104px_1fr] items-baseline border-b border-hairline px-0.5 py-3">
              <span className="text-[12px] font-extrabold tracking-k2 text-mute">TITLE TRACK</span>
              <span className="text-[15px] font-semibold">{titleTrack.title}</span>
            </div>
          )}
          {tracks.length > 0 && (
            <div className="grid grid-cols-[104px_1fr] items-baseline border-b border-hairline px-0.5 py-3">
              <span className="text-[12px] font-extrabold tracking-k2 text-mute">TRACKS</span>
              <span className="text-[15px] font-semibold">
                {tracks.length}곡{totalDuration ? ` · ${totalDuration}` : ''}
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* 버튼 */}
      <div className="flex gap-2.5 px-[22px] pb-1.5 pt-[18px]">
        {titleTrack?.video_url && (
          <a
            href={titleTrack.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-ink py-[13px] text-center text-[13px] font-extrabold tracking-k15 text-white"
          >
            ▶ 뮤직비디오
          </a>
        )}
        {album.description && (
          <button
            type="button"
            onClick={openDescription}
            className="flex-1 border border-ink py-[13px] text-center text-[13px] font-extrabold tracking-k15 text-ink"
          >
            앨범 소개
          </button>
        )}
      </div>

      {/* TRACKLIST */}
      {tracks.length > 0 && (
        <>
          <Reveal className="flex items-baseline justify-between px-[22px] pb-3 pt-7">
            <b className="text-[13px] font-extrabold tracking-k3">TRACKLIST</b>
            <span className="text-[13px] font-bold text-mute">{tracks.length}곡</span>
          </Reveal>
          <Reveal className="mx-[22px] border-t-2 border-ink">
            {tracks.map((t) => (
              <Link
                key={t.id}
                to={`/album/${album.folder_name}/track/${encodeURIComponent(t.title)}`}
                className="flex items-baseline gap-3.5 border-b border-hairline px-0.5 py-3.5"
              >
                <span
                  className="w-6 shrink-0 text-[13.5px] font-extrabold text-faint"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {String(t.track_number).padStart(2, '0')}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="min-w-0 truncate text-[15.5px] font-bold tracking-[-0.2px]">
                    {t.title}
                  </span>
                  {!!t.is_title_track && (
                    <i className="not-italic shrink-0 rounded-[3px] bg-primary px-1.5 py-0.5 text-[12px] font-extrabold tracking-k1 text-white">
                      TITLE
                    </i>
                  )}
                </span>
                <span className="shrink-0 text-[13.5px] text-mute" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t.duration || ''}
                </span>
              </Link>
            ))}
          </Reveal>
        </>
      )}

      {/* TEASERS */}
      {teasers.length > 0 && (
        <>
          <Reveal className="flex items-baseline justify-between px-[22px] pb-3 pt-7">
            <b className="text-[13px] font-extrabold tracking-k3">TEASERS</b>
          </Reveal>
          <Reveal className="scrollbar-hide flex gap-2 overflow-x-auto px-[22px] pb-1.5">
            {teasers.map((t, i) => (
              <button
                key={t.original_url || i}
                type="button"
                onClick={() =>
                  openLightbox(
                    teasers.map((x) =>
                      x.media_type === 'video' ? x.video_url || x.original_url : x.original_url || x.medium_url
                    ),
                    i,
                    teasers
                  )
                }
                className="relative block w-[110px] shrink-0"
              >
                <img src={t.thumb_url || t.medium_url} alt="" className="block aspect-square w-full object-cover" />
                {t.media_type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[13px] text-ink">
                      ▶
                    </span>
                  </span>
                )}
              </button>
            ))}
          </Reveal>
        </>
      )}

      {/* CONCEPT PHOTOS */}
      {conceptPhotos.length > 0 && (
        <>
          <Reveal className="flex items-baseline justify-between px-[22px] pb-3 pt-7">
            <b className="text-[13px] font-extrabold tracking-k3">CONCEPT PHOTOS</b>
          </Reveal>
          <Reveal className="flex gap-2 px-[22px] pb-14 pt-1">
            {conceptPhotos.slice(0, 3).map((p, i) => (
              <button
                key={p.id || i}
                type="button"
                onClick={() =>
                  openLightbox(
                    conceptPhotos.slice(0, 3).map((x) => x.medium_url),
                    i,
                    null,
                    conceptPhotos.slice(0, 3)
                  )
                }
                className="min-w-0 flex-1"
              >
                <img
                  src={p.medium_url || p.thumb_url}
                  alt=""
                  className="block aspect-[0.8] w-full object-cover"
                  style={{ filter: 'saturate(1.02)' }}
                />
              </button>
            ))}
            {conceptPhotos.length > 3 && (
              <Link
                to={`/album/${album.folder_name}/gallery`}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border border-hairline text-esub"
              >
                <b className="text-[16.5px] font-black text-ink">+{conceptPhotos.length - 3}</b>
                <span className="text-[13px] font-bold tracking-[0.5px]">전체보기</span>
              </Link>
            )}
          </Reveal>
        </>
      )}
      </div>

      <MobileLightbox
        images={lightbox.images}
        photos={lightbox.photos}
        teasers={lightbox.teasers}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((l) => ({ ...l, open: false }))}
        onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
      />

      {/* 앨범 소개 시트 */}
      {showDescription && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50" onClick={closeDescription}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto border-t border-ink bg-paper"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-hairline bg-paper px-5 py-3.5">
              <b className="text-[13px] font-extrabold tracking-k25">ABOUT — {album.title}</b>
              <button type="button" onClick={closeDescription} className="p-1 text-mute active:text-ink">
                <X size={17} />
              </button>
            </div>
            <p className="whitespace-pre-line px-5 py-4 text-[14.5px] leading-[1.75] text-ebody">
              {album.description}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileAlbumDetail;
