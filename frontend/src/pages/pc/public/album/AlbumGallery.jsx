import ContentState from '@/components/pc/public/ContentState';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlbumByName } from '@/api';
import { Lightbox, Loading } from '@/components/common';
import { useDocumentTitle } from '@/hooks/common';
import { JustifiedGallery } from '@/components/editorial/JustifiedGallery';
import { TYPE_LABEL } from '@/constants';

/**
 * PC 앨범 갤러리 — 에디토리얼 리뉴얼 (design-drafts/A_final_gallery_pc 시안)
 * 컨셉/타입 필터 + justified + 라이트박스
 */
function PCAlbumGallery() {
  const { name } = useParams();

  const { data: album, isLoading, error, refetch } = useQuery({
    queryKey: ['album', name],
    queryFn: () => getAlbumByName(name),
  });

  useDocumentTitle(album ? `${album.title} - 컨셉 포토` : undefined);

  // {컨셉: [photos]} → flat + 컨셉명·캡션 부여
  const { photos, concepts } = useMemo(() => {
    const cp = album?.conceptPhotos || {};
    const flat = [];
    const isRealConcept = (c) => c && c.toLowerCase() !== 'default';
    Object.entries(cp).forEach(([concept, list]) => {
      list.forEach((p) =>
        flat.push({
          ...p,
          concept,
          photo_type: p.type,
          title: isRealConcept(concept) ? concept.toUpperCase() : null,
          caption: isRealConcept(concept) ? concept.toUpperCase() : null,
        })
      );
    });
    return { photos: flat, concepts: Object.keys(cp).filter(isRealConcept) };
  }, [album]);

  const [filter, setFilter] = useState({ kind: 'all', value: null });
  const filtered = useMemo(() => {
    if (filter.kind === 'concept') return photos.filter((p) => p.concept === filter.value);
    if (filter.kind === 'type') return photos.filter((p) => p.photo_type === filter.value);
    return photos;
  }, [photos, filter]);

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });

  useEffect(() => { setFilter({ kind: 'all', value: null }); setLightbox({ open: false, index: 0 }); }, [name]);

  if (isLoading) return <Loading />;
  if (error && error.status !== 404) return <ContentState onRetry={refetch}>앨범을 불러오지 못했습니다.</ContentState>;
  if (!album) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper py-40 text-mute">
        앨범을 찾을 수 없습니다
      </div>
    );
  }

  const typeCounts = photos.reduce((acc, p) => {
    if (p.photo_type) acc[p.photo_type] = (acc[p.photo_type] || 0) + 1;
    return acc;
  }, {});
  const isActive = (kind, value) => filter.kind === kind && filter.value === value;
  const chip = (active) =>
    `max-w-full break-words border px-[18px] py-[9px] text-[13px] font-extrabold tracking-k15 transition-colors ${
      active ? 'border-ink bg-ink text-white' : 'border-hairline text-esub hover:border-ink'
    }`;

  return (
    <div className="min-w-0 flex-1 break-words bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 헤더 */}
        <div className="flex items-end justify-between gap-6 border-b border-hairline pb-9 pt-14">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold tracking-k25 text-mute">
              <Link to="/album" className="hover:text-ink">DISCOGRAPHY</Link>
              <i className="not-italic mx-2 text-primary">/</i>
              <Link to={`/album/${album.folder_name}`} className="hover:text-ink">
                {album.title}
              </Link>
            </div>
            <h1 className="mt-3.5 text-[56px] font-black leading-none tracking-[-2.5px]">
              CONCEPT PHOTOS
            </h1>
          </div>
          <div className="shrink-0 text-right text-[13.5px] font-semibold tracking-k2 text-mute">
            {photos.length} PHOTOS
          </div>
        </div>

        {/* 필터: 컨셉 + 타입 */}
        <div className="flex flex-wrap gap-2 border-b border-hairline py-5">
          <button aria-pressed={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all', value: null })} className={chip(filter.kind === 'all')}>
            ALL {photos.length}
          </button>
          {concepts.map((c) => (
              <button
                key={c}
                aria-pressed={isActive('concept', c)}
                onClick={() => setFilter({ kind: 'concept', value: c })}
                className={chip(isActive('concept', c))}
              >
                {c.toUpperCase()}
              </button>
          ))}
          {['group', 'unit', 'solo']
            .filter((t) => typeCounts[t])
            .map((t) => (
              <button
                key={t}
                aria-pressed={isActive('type', t)}
                onClick={() => setFilter({ kind: 'type', value: t })}
                className={chip(isActive('type', t))}
              >
                {TYPE_LABEL[t]} {typeCounts[t]}
              </button>
            ))}
        </div>

        <div className="pt-[34px]">
          {!filtered.length && <ContentState>등록된 사진이 없습니다.</ContentState>}
          <JustifiedGallery
            photos={filtered}
            onPhotoClick={(p, i) => setLightbox({ open: true, index: i })}
          />
        </div>

        <Lightbox
          images={filtered.map((p) => p.medium_url || p.thumb_url || p.original_url)}
          photos={filtered}
          currentIndex={lightbox.index}
          isOpen={lightbox.open}
          onClose={() => setLightbox((l) => ({ ...l, open: false }))}
          onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
        />
      </div>
    </div>
  );
}

export default PCAlbumGallery;
