import ContentState from '@/components/pc/public/ContentState';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { getAlbumByName } from '@/api';
import { MobileLightbox, Loading } from '@/components/common';
import { useDocumentTitle } from '@/hooks/common';
import { Reveal } from '@/components/editorial';
import { MasonryGallery } from '@/components/editorial/MasonryGallery';
import { TYPE_LABEL } from '@/constants';

/**
 * 모바일 앨범 갤러리 — 에디토리얼 리뉴얼 (A_final_gallery_mobile 시안)
 * 컨셉/타입 필터 + 2열 masonry
 */
function MobileAlbumGallery() {
  const { name } = useParams();

  const { data: album, isLoading, error, refetch } = useQuery({
    queryKey: ['album', name],
    queryFn: () => getAlbumByName(name),
  });

  useDocumentTitle(album ? `${album.title} - 컨셉 포토` : undefined);

  // {컨셉: [photos]} → flat + 컨셉명·캡션 부여 (PC와 동일)
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
  const openLightbox = useCallback((index) => {
    setLightbox({ open: true, index });
  }, []);

  if (isLoading) return <Loading className="min-h-0 flex-1 py-12" />;
  if (error && error.status !== 404) return <ContentState onRetry={refetch}>앨범을 불러오지 못했습니다.</ContentState>;
  if (!album) {
    return <ContentState>앨범을 찾을 수 없습니다.</ContentState>;
  }

  const typeCounts = photos.reduce((acc, p) => {
    if (p.photo_type) acc[p.photo_type] = (acc[p.photo_type] || 0) + 1;
    return acc;
  }, {});
  const isActive = (kind, value) => filter.kind === kind && filter.value === value;
  const chip = (active) =>
    `shrink-0 border px-[13px] py-[7px] text-[12px] font-extrabold tracking-k1 transition-colors ${
      active ? 'border-ink bg-ink text-white' : 'border-hairline text-esub'
    }`;

  return (
    <>
      {/* 크럼 + 타이틀 + 필터 (고정) */}
      <div className="safe-area-top shrink-0 bg-paper">
      {/* 크럼 + 타이틀 */}
      <div className="border-b border-hairline">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <Link to={`/album/${album.folder_name}`} className="p-2 text-esub active:text-ink" aria-label="앨범 상세로">
            <ChevronLeft size={20} />
          </Link>
          <b className="min-w-0 truncate text-[13.5px] font-extrabold tracking-k25 text-mute">
            DISCOGRAPHY / {album.title}
          </b>
        </div>
        <div className="flex items-end justify-between px-[22px] pb-[18px] pt-1.5">
          <h1 className="text-[30px] font-black leading-none tracking-[-1.2px]">CONCEPT PHOTOS</h1>
        </div>
      </div>

      {/* 필터: 컨셉 + 타입 */}
      <div className="scrollbar-hide flex gap-1.5 overflow-x-auto border-b border-hairline px-[22px] py-3.5">
        <button aria-pressed={filter.kind === 'all'} type="button" onClick={() => setFilter({ kind: 'all', value: null })} className={chip(filter.kind === 'all')}>
          ALL {photos.length}
        </button>
        {concepts.map((c) => (
          <button
            key={c}
            aria-pressed={isActive('concept', c)}
            type="button"
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
              type="button"
              onClick={() => setFilter({ kind: 'type', value: t })}
              className={chip(isActive('type', t))}
            >
              {TYPE_LABEL[t]} {typeCounts[t]}
            </button>
          ))}
      </div>
      </div>

      {/* 2열 masonry (스크롤 영역) */}
      <div className="mobile-content bg-paper text-ink break-words">
        <Reveal className="px-[10px] pb-14 pt-[14px]">
          {!filtered.length && <ContentState>등록된 사진이 없습니다.</ContentState>}
          <MasonryGallery photos={filtered} gap={10} onPhotoClick={(p, i) => openLightbox(i)} />
        </Reveal>
      </div>

      <MobileLightbox
        images={filtered.map((p) => p.medium_url || p.thumb_url || p.original_url)}
        photos={filtered}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((l) => ({ ...l, open: false }))}
        onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
      />
    </>
  );
}

export default MobileAlbumGallery;
