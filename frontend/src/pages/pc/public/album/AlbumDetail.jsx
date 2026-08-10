import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlbumByName } from '@/api';
import { calculateTotalDuration } from '@/utils';
import { Lightbox, Loading } from '@/components/common';
import { useDocumentTitle } from '@/hooks/common';
import { FactSheet, SectionHeader, InkButton, OutlineButton, Reveal } from '@/components/editorial';
import { useDialogBackClose } from '@/hooks/common';

/**
 * PC 앨범 상세 — 에디토리얼 리뉴얼 (design-drafts/A_final_detail_pc 시안)
 */
function PCAlbumDetail() {
  const { name } = useParams();

  const { data: album, isLoading } = useQuery({
    queryKey: ['album', name],
    queryFn: () => getAlbumByName(name),
  });

  useDocumentTitle(album?.title);

  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, teasers: null, photos: null });
  const [showDescription, setShowDescription] = useState(false);
  // 뒤로가기 시 소개 모달만 닫기
  useDialogBackClose(showDescription, () => setShowDescription(false));

  const tracks = album?.tracks || [];
  const titleTrack = tracks.find((t) => t.is_title_track) || tracks[0];
  const totalDuration = useMemo(() => calculateTotalDuration(tracks), [tracks]);

  // 컨셉 포토 flatten (dict {컨셉: [photos]}) — 미리보기 4장 + 전체 수 (컨셉명·멤버 유지)
  const conceptPhotos = useMemo(() => {
    const cp = album?.conceptPhotos;
    if (!cp) return [];
    const isRealConcept = (c) => c && c.toLowerCase() !== 'default';
    const flat = [];
    Object.entries(cp).forEach(([concept, list]) => {
      list.forEach((p) =>
        flat.push({ ...p, title: isRealConcept(concept) ? concept.toUpperCase() : null })
      );
    });
    return flat;
  }, [album]);

  const teasers = album?.teasers || [];

  if (isLoading) return <Loading />;
  if (!album) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper py-40 text-mute">
        앨범을 찾을 수 없습니다
      </div>
    );
  }

  const openLightbox = (images, index, teasersMeta = null, photosMeta = null) =>
    setLightbox({ open: true, images, index, teasers: teasersMeta, photos: photosMeta });

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 스프레드 */}
        <div className="grid grid-cols-[1fr_1.1fr] border-b border-hairline">
          <div className="border-r border-hairline">
            {album.cover_medium_url || album.cover_original_url ? (
              <button
                type="button"
                onClick={() =>
                  openLightbox([album.cover_original_url || album.cover_medium_url], 0)
                }
                className="group block h-full w-full overflow-hidden"
              >
                <img
                  src={album.cover_medium_url || album.cover_original_url}
                  alt={album.title}
                  className="block h-full min-h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </button>
            ) : (
              <div className="flex h-full min-h-[480px] w-full items-center justify-center bg-canvas-deep text-[56px] text-faint">
                ◉
              </div>
            )}
          </div>
          <div className="flex flex-col py-16 pl-16">
            <div className="text-[13px] font-extrabold tracking-k25 text-mute">
              <Link to="/album" className="hover:text-ink">DISCOGRAPHY</Link>
              <i className="not-italic mx-2 text-primary">/</i>
              {album.title}
            </div>
            <span className="mt-8 text-[14.5px] font-extrabold tracking-k3 text-primary">
              {album.album_type}
            </span>
            <h1 className="mt-3 text-[58px] font-black leading-[1.05] tracking-[-2.2px]" style={{ textWrap: 'balance' }}>
              {album.title}
            </h1>
            <FactSheet
              className="mt-9"
              items={[
                {
                  k: 'RELEASE',
                  v: album.release_date?.slice(0, 10).replaceAll('-', '. '),
                },
                ...(titleTrack ? [{ k: 'TITLE TRACK', v: titleTrack.title }] : []),
                ...(tracks.length
                  ? [{ k: 'TRACKS', v: `${tracks.length}곡${totalDuration ? ` · ${totalDuration}` : ''}` }]
                  : []),
              ]}
            />
            <div className="mt-auto flex gap-3 pt-9">
              {titleTrack?.video_url && (
                <a href={titleTrack.video_url} target="_blank" rel="noopener noreferrer">
                  <InkButton>▶ 뮤직비디오</InkButton>
                </a>
              )}
              {album.description && (
                <OutlineButton onClick={() => setShowDescription(true)}>앨범 소개</OutlineButton>
              )}
            </div>
          </div>
        </div>

        {/* TRACKLIST */}
        {tracks.length > 0 && (
          <>
            <Reveal>
            <SectionHeader label="TRACKLIST" className="pb-[22px] pt-[54px]" />
            <div className="border-t-2 border-ink">
              {tracks.map((t) => (
                <Link
                  key={t.id}
                  to={`/album/${album.folder_name}/track/${encodeURIComponent(t.title)}`}
                  className="grid grid-cols-[70px_1fr_190px_80px] items-baseline border-b border-hairline px-1 py-[17px] transition-colors hover:bg-canvas"
                >
                  <span className="text-[15px] font-extrabold text-faint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {String(t.track_number).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="text-[17px] font-bold tracking-[-0.2px]">{t.title}</span>
                    {!!t.is_title_track && (
                      <i className="not-italic ml-2.5 rounded-[3px] bg-primary px-[7px] py-0.5 align-[2px] text-[12px] font-extrabold tracking-k1 text-white">
                        TITLE
                      </i>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-right text-[13px] font-bold tracking-k15 text-mute">
                    {[
                      t.video_url ? (t.video_type === 'special' ? 'SPECIAL VIDEO' : 'MV') : null,
                      t.lyrics ? 'LYRICS' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="text-right text-[14.5px] text-mute" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t.duration || ''}
                  </span>
                </Link>
              ))}
            </div>
            </Reveal>
          </>
        )}

        {/* TEASERS */}
        {teasers.length > 0 && (
          <>
            <Reveal>
            <SectionHeader label="TEASERS" className="pb-[22px] pt-[54px]" />
            <div className="flex gap-4">
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
                  className="group relative block w-[180px] overflow-hidden"
                >
                  <img
                    src={t.thumb_url || t.medium_url}
                    alt=""
                    className="block aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                  />
                  {t.media_type === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[14.5px] text-ink">
                        ▶
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
            </Reveal>
          </>
        )}

        {/* CONCEPT PHOTOS */}
        {conceptPhotos.length > 0 && (
          <>
            <Reveal>
            <SectionHeader label="CONCEPT PHOTOS" className="pb-[22px] pt-[54px]" />
            <div className="flex gap-4">
              {conceptPhotos.slice(0, 4).map((p, i) => (
                <button
                  key={p.id || i}
                  type="button"
                  onClick={() =>
                    openLightbox(
                      conceptPhotos.slice(0, 4).map((x) => x.medium_url),
                      i,
                      null,
                      conceptPhotos.slice(0, 4)
                    )
                  }
                  className="group min-w-0 flex-1 overflow-hidden"
                >
                  <img
                    src={p.medium_url || p.thumb_url}
                    alt=""
                    className="block aspect-[0.8] w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    style={{ filter: 'saturate(1.02)' }}
                  />
                </button>
              ))}
              {conceptPhotos.length > 4 && (
                <Link
                  to={`/album/${album.folder_name}/gallery`}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 border border-hairline text-esub transition-colors hover:bg-canvas"
                >
                  <b className="text-[22px] font-black text-ink">+{conceptPhotos.length - 4}</b>
                  <span className="text-[13.5px] font-bold tracking-[0.5px]">전체보기</span>
                </Link>
              )}
            </div>
            </Reveal>
          </>
        )}

        <Lightbox
          images={lightbox.images}
          teasers={lightbox.teasers}
          photos={lightbox.photos}
          currentIndex={lightbox.index}
          isOpen={lightbox.open}
          onClose={() => setLightbox((l) => ({ ...l, open: false }))}
          onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
        />

        {/* 앨범 소개 모달 */}
        {showDescription && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
            onClick={() => setShowDescription(false)}
          >
            <div
              className="max-h-[70vh] w-full max-w-[560px] overflow-y-auto border border-ink bg-paper"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
                <b className="text-[13.5px] font-extrabold tracking-k3">ABOUT — {album.title}</b>
                <button
                  type="button"
                  onClick={() => setShowDescription(false)}
                  className="text-[16px] text-mute hover:text-ink"
                >
                  ✕
                </button>
              </div>
              <p className="whitespace-pre-line px-6 py-5 text-left text-[15px] leading-[1.75] text-ebody">
                {album.description}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PCAlbumDetail;
