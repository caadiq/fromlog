import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTrack } from '@/api';
import { getYoutubeVideoId, parseCredits } from '@/utils';
import { useDocumentTitle } from '@/hooks/common';
import { Loading } from '@/components/common';
import { fadeUp, stagger, Reveal } from '@/components/editorial';

/**
 * 모바일 곡 상세 — 에디토리얼 리뉴얼 (A_final_track_mobile 시안)
 */
function MobileTrackDetail() {
  const { name: albumName, trackTitle } = useParams();

  const { data: track, isLoading } = useQuery({
    queryKey: ['track', albumName, trackTitle],
    queryFn: () => getTrack(albumName, trackTitle),
    enabled: !!albumName && !!trackTitle,
  });

  useDocumentTitle(track?.title);

  const youtubeVideoId = useMemo(() => getYoutubeVideoId(track?.video_url), [track?.video_url]);
  const videoLabel = track?.video_type === 'special' ? 'SPECIAL VIDEO' : 'OFFICIAL MV';
  const [lyricsOpen, setLyricsOpen] = useState(false);

  if (isLoading) return <Loading />;
  if (!track) {
    return <div className="flex items-center justify-center py-40 text-mute">곡을 찾을 수 없습니다</div>;
  }

  const album = track.album || {};
  const credits = [
    { k: '작사', v: parseCredits(track.lyricist) },
    { k: '작곡', v: parseCredits(track.composer) },
    { k: '편곡', v: parseCredits(track.arranger) },
  ].filter((c) => c.v.length > 0);

  const lyricsLines = (track.lyrics || '').split('\n');
  const lyricsPreview = lyricsLines.slice(0, 10).join('\n');
  const lyricsLong = lyricsLines.length > 10;

  return (
    <div className="bg-paper text-ink">
      {/* 크럼 */}
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <Link to={`/album/${album.folder_name}`} className="p-2 text-esub active:text-ink" aria-label="앨범 상세로">
          <ChevronLeft size={20} />
        </Link>
        <b className="min-w-0 truncate text-[13.5px] font-extrabold tracking-k25 text-mute">
          {(album.title || '').toUpperCase()} / TRACK {String(track.track_number).padStart(2, '0')}
        </b>
      </div>

      {/* 히어로 */}
      <motion.div
        className="relative border-b border-hairline px-[22px] pb-[26px] pt-[30px]"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <span
          className="pointer-events-none absolute right-[18px] top-[22px] z-0 text-[64px] font-black leading-none tracking-[-3px] text-transparent"
          style={{ WebkitTextStroke: '1.5px #E2E4DC' }}
        >
          {String(track.track_number).padStart(2, '0')}
        </span>
        <motion.div variants={fadeUp} className="relative z-10 h-[20px]">
          {!!track.is_title_track && (
            <span className="inline-block rounded-[3px] bg-primary px-2 py-[3px] text-[12px] font-extrabold tracking-k15 text-white">
              TITLE
            </span>
          )}
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="relative z-10 mt-2.5 text-[40px] font-black leading-[1.02] tracking-[-1.8px]"
          style={{ textWrap: 'balance' }}
        >
          {track.title}
        </motion.h1>
        <motion.p variants={fadeUp} className="relative z-10 mt-2.5 text-[14px] text-esub">
          <Link to={`/album/${album.folder_name}`} className="font-bold text-ink">
            {album.title}
          </Link>
          {' · '}
          {album.album_type}
          {track.duration ? ` · ${track.duration}` : ''}
        </motion.p>
      </motion.div>

      {/* MV 임베드 */}
      {youtubeVideoId && (
        <div className="border-b border-hairline">
          <div className="aspect-video w-full bg-ink">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              title={track.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <div className="px-[22px] py-2.5 text-[12px] font-extrabold tracking-k2 text-mute">
            {videoLabel} — YOUTUBE
          </div>
        </div>
      )}

      <div className="px-[22px] pb-14 pt-6">
        {/* CREDITS */}
        {credits.length > 0 && (
          <Reveal className="mb-[26px]">
            <div className="border-t-2 border-ink pb-3.5 pt-3.5 text-[13px] font-extrabold tracking-k3">
              CREDITS
            </div>
            {credits.map((c) => (
              <div key={c.k} className="grid grid-cols-[64px_1fr] border-b border-hairline px-0.5 py-[11px]">
                <span className="text-[12px] font-extrabold tracking-k2 text-mute">{c.k}</span>
                <span className="text-[14px] font-semibold leading-[1.6]">{c.v.join(', ')}</span>
              </div>
            ))}
          </Reveal>
        )}

        {/* LYRICS */}
        <Reveal>
          <div className="border-t-2 border-ink pb-3.5 pt-3.5 text-[13px] font-extrabold tracking-k3">
            LYRICS
          </div>
          {track.lyrics ? (
            <>
              <p className="whitespace-pre-line text-[15px] leading-[2.1] text-ebody">
                {lyricsOpen || !lyricsLong ? track.lyrics : `${lyricsPreview}\n⋯`}
              </p>
              {lyricsLong && (
                <button
                  type="button"
                  onClick={() => setLyricsOpen((v) => !v)}
                  className="mt-4 text-[12.5px] font-extrabold tracking-k2 text-primary"
                >
                  {lyricsOpen ? '가사 접기 ↑' : '전체 가사 펼치기 ↓'}
                </button>
              )}
            </>
          ) : (
            <p className="py-8 text-[14.5px] text-mute">가사 정보가 없습니다</p>
          )}
        </Reveal>

        {/* IN THIS ALBUM */}
        {(track.otherTracks || []).length > 0 && (
          <Reveal className="mt-8">
            <div className="border-t-2 border-ink pb-1 pt-3.5 text-[13px] font-extrabold tracking-k3">
              IN THIS ALBUM
            </div>
            {(track.otherTracks || []).map((t) => {
              const current = t.id === track.id;
              return (
                <Link
                  key={t.id}
                  to={`/album/${album.folder_name}/track/${encodeURIComponent(t.title)}`}
                  className="flex items-baseline gap-3.5 border-b border-hairline px-0.5 py-3"
                >
                  <span
                    className={`w-6 shrink-0 text-[13px] font-extrabold ${current ? 'text-primary' : 'text-faint'}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {String(t.track_number).padStart(2, '0')}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[14.5px] ${
                      current ? 'font-extrabold text-ink' : 'font-semibold text-esub'
                    }`}
                  >
                    {t.title}
                    {!!t.is_title_track && (
                      <i className="not-italic ml-1.5 rounded-[3px] bg-primary px-1.5 py-0.5 align-[1px] text-[12px] font-extrabold tracking-k1 text-white">
                        TITLE
                      </i>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-[13px] ${current ? 'text-ink' : 'text-faint'}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t.duration || ''}
                  </span>
                </Link>
              );
            })}
          </Reveal>
        )}
      </div>
    </div>
  );
}

export default MobileTrackDetail;
