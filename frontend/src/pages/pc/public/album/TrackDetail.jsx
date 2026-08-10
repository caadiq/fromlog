import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTrack } from '@/api';
import { getYoutubeVideoId, parseCredits } from '@/utils';
import { useDocumentTitle } from '@/hooks/common';
import { Loading } from '@/components/common';
import { SectionHeader, Reveal } from '@/components/editorial';

/**
 * PC 곡 상세 — 에디토리얼 리뉴얼 (design-drafts/A_final_track_pc 시안)
 */
function PCTrackDetail() {
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
    return (
      <div className="flex flex-1 items-center justify-center bg-paper py-40 text-mute">
        곡을 찾을 수 없습니다
      </div>
    );
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
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 히어로 */}
        <div className={`grid ${youtubeVideoId ? 'grid-cols-[1.05fr_0.95fr]' : 'grid-cols-1'}`}>
          <div className={`relative pb-5 pt-[60px] ${youtubeVideoId ? 'border-r border-hairline pr-[50px]' : ''}`}>
            {/* 아웃라인 트랙 번호 워터마크 */}
            <span
              className="pointer-events-none absolute right-[44px] top-[52px] text-[100px] font-black leading-none tracking-[-5px] text-transparent"
              style={{ WebkitTextStroke: '2px #E2E4DC' }}
            >
              {String(track.track_number).padStart(2, '0')}
            </span>
            <div className="text-[13px] font-extrabold tracking-k25 text-mute">
              <Link to={`/album/${album.folder_name}`} className="hover:text-ink">
                {(album.title || '').toUpperCase()}
              </Link>
              <i className="not-italic mx-2 text-primary">/</i>
              TRACK {String(track.track_number).padStart(2, '0')}
            </div>
            {/* TITLE 태그 유무와 무관하게 곡명 시작 위치 고정 (워터마크 겹침 방지) */}
            <div className="mt-9 h-[22px]">
              {!!track.is_title_track && (
                <span className="inline-block rounded-[3px] bg-primary px-[9px] py-[3px] text-[12px] font-extrabold tracking-k15 text-white">
                  TITLE
                </span>
              )}
            </div>
            <h1
              className="mt-3 text-[64px] font-black leading-[1.02] tracking-[-2.5px]"
              style={{ textWrap: 'balance' }}
            >
              {track.title}
            </h1>
            <p className="mt-3.5 text-[15px] text-esub">
              <Link to={`/album/${album.folder_name}`} className="font-bold text-ink hover:underline">
                {album.title}
              </Link>
              {' · '}
              {album.album_type}
              {track.duration ? ` · ${track.duration}` : ''}
            </p>
            {credits.length > 0 && (
              <div className="mt-8 border-t-2 border-ink">
                {credits.map((c) => (
                  <div
                    key={c.k}
                    className="grid grid-cols-[110px_1fr] items-baseline border-b border-hairline px-1 py-[13px]"
                  >
                    <span className="text-[13px] font-extrabold tracking-k25 text-mute">{c.k}</span>
                    <span className="text-[15px] font-semibold leading-[1.65]">
                      {c.v.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* MV — 유튜브 임베드 */}
          {youtubeVideoId && (
            <div className="flex flex-col justify-center py-[60px] pl-[50px]">
              <div className="aspect-video w-full overflow-hidden bg-ink">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                  title={track.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
              <div className="mt-3 text-[13px] font-extrabold tracking-k25 text-mute">
                {videoLabel} — YOUTUBE
              </div>
            </div>
          )}
        </div>

        {/* 본문: 가사 / 같은 앨범 트랙 */}
        <Reveal className="grid grid-cols-2 gap-[70px] pt-[54px]">
          <div>
            <SectionHeader label="LYRICS" className="border-t-2 border-ink pb-5 pt-4" />
            {track.lyrics ? (
              <>
                <p className="whitespace-pre-line text-[16px] leading-[2.15] text-ebody">
                  {lyricsOpen || !lyricsLong ? track.lyrics : `${lyricsPreview}\n⋯`}
                </p>
                {lyricsLong && (
                  <button
                    type="button"
                    onClick={() => setLyricsOpen((v) => !v)}
                    className="mt-5 text-[13px] font-extrabold tracking-k2 text-primary"
                  >
                    {lyricsOpen ? '가사 접기 ↑' : '전체 가사 펼치기 ↓'}
                  </button>
                )}
              </>
            ) : (
              <p className="py-10 text-[15px] text-mute">가사 정보가 없습니다</p>
            )}
          </div>
          <div>
            <SectionHeader label="IN THIS ALBUM" className="border-t-2 border-ink pb-5 pt-4" />
            <div>
              {(track.otherTracks || []).map((t) => {
                const current = t.id === track.id;
                return (
                  <Link
                    key={t.id}
                    to={`/album/${album.folder_name}/track/${encodeURIComponent(t.title)}`}
                    className={`grid grid-cols-[44px_1fr_60px] items-baseline border-b border-hairline px-0.5 py-[14px] transition-colors ${
                      current ? '' : 'hover:bg-canvas'
                    }`}
                  >
                    <span
                      className={`text-[14.5px] font-extrabold ${current ? 'text-primary' : 'text-faint'}`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {String(t.track_number).padStart(2, '0')}
                    </span>
                    <span
                      className={`overflow-hidden text-ellipsis whitespace-nowrap text-[16px] ${
                        current ? 'font-extrabold text-ink' : 'font-semibold text-esub'
                      }`}
                    >
                      {t.title}
                      {!!t.is_title_track && (
                        <i className="not-italic ml-2 rounded-[3px] bg-primary px-1.5 py-0.5 align-[1px] text-[12px] font-extrabold tracking-k1 text-white">
                          TITLE
                        </i>
                      )}
                    </span>
                    <span
                      className={`text-right text-[14px] ${current ? 'text-ink' : 'text-faint'}`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {t.duration || ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export default PCTrackDetail;
