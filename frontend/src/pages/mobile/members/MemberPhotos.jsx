import ContentState from '@/components/pc/public/ContentState';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useMembers, useDocumentTitle, useMemberAllPhotos } from '@/hooks';
import { Loading, MobileLightbox } from '@/components/common';
import { Reveal } from '@/components/editorial';
import { MasonryGallery } from '@/components/editorial/MasonryGallery';
import { TYPE_LABEL } from '@/constants';

/**
 * 모바일 멤버 갤러리 — 멤버 포함 컨셉 포토 전체 (2열 그리드 + 타입 필터)
 */
function MobileMemberPhotos() {
  const { name } = useParams();
  const { data: members = [], isLoading: membersLoading, isError: membersError, refetch: retryMembers } = useMembers();
  const member = useMemo(
    () => members.find((m) => (m.name_en || '').toLowerCase() === (name || '').toLowerCase()),
    [members, name]
  );

  const { data, isLoading, isError, refetch } = useMemberAllPhotos(member?.name_en);
  const photos = data?.photos || [];

  useDocumentTitle(member ? `${member.name} - PHOTOS` : undefined);

  const [filter, setFilter] = useState('all');
  const filtered = useMemo(
    () => (filter === 'all' ? photos : photos.filter((p) => p.photo_type === filter)),
    [photos, filter]
  );

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  useEffect(() => { setFilter('all'); setLightbox({ open: false, index: 0 }); }, [name]);

  const openLightbox = (index) => {
    setLightbox({ open: true, index });
  };

  if (membersLoading) return <Loading className="min-h-0 flex-1 py-12" />;
  if (membersError) return <ContentState onRetry={retryMembers}>멤버 정보를 불러오지 못했습니다.</ContentState>;
  if (!member) return <ContentState>멤버를 찾을 수 없습니다.</ContentState>;
  if (isLoading) return <Loading className="min-h-0 flex-1 py-12" />;
  if (isError) return <ContentState onRetry={refetch}>사진을 불러오지 못했습니다.</ContentState>;

  const typeCounts = photos.reduce((acc, p) => {
    acc[p.photo_type] = (acc[p.photo_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {/* 크럼 + 타이틀 + 필터 (고정) */}
      <div className="safe-area-top shrink-0 bg-paper">
      {/* 크럼 바 + 타이틀 */}
      <div className="border-b border-hairline">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <Link
            to={`/members/${(member.name_en || '').toLowerCase()}`}
            className="p-2 text-esub active:text-ink"
            aria-label="멤버 상세로"
          >
            <ChevronLeft size={20} />
          </Link>
          <b className="min-w-0 truncate text-[13.5px] font-extrabold tracking-k25 text-mute">
            MEMBERS / {member.name}
          </b>
        </div>
        <div className="flex items-end justify-between px-[22px] pb-5 pt-2">
          <h1 className="text-[34px] font-black leading-none tracking-[-1.5px]">PHOTOS</h1>
          <span className="text-[13px] font-semibold tracking-k15 text-mute">{photos.length} PHOTOS</span>
        </div>
      </div>

      {/* 타입 필터 */}
      <div className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-hairline px-[22px] py-3.5">
        {[
          { key: 'all', label: `전체 ${photos.length}` },
          ...['group', 'unit', 'solo']
            .filter((t) => typeCounts[t])
            .map((t) => ({ key: t, label: `${TYPE_LABEL[t]} ${typeCounts[t]}` })),
        ].map((f) => (
          <button
            key={f.key}
            aria-pressed={filter === f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 border px-3.5 py-2 text-[13px] font-extrabold tracking-k1 transition-colors ${
              filter === f.key ? 'border-ink bg-ink text-white' : 'border-hairline text-esub'
            }`}
          >
            {f.label}
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
        photos={filtered.map((p) => ({ ...p, concept: p.concept_name, albumTitle: p.album_title }))}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((l) => ({ ...l, open: false }))}
        onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
      />
    </>
  );
}

export default MobileMemberPhotos;
