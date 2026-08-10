import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMembers, useDocumentTitle, useMemberAllPhotos } from '@/hooks';
import { Loading, Lightbox } from '@/components/common';
import { JustifiedGallery } from '@/components/editorial/JustifiedGallery';
import { TYPE_LABEL } from '@/constants';

/**
 * PC 멤버 갤러리 — 멤버가 포함된 컨셉 포토 전체 (단체·유닛 포함, justified)
 */
function MemberPhotos() {
  const { name } = useParams();
  const { data: members = [] } = useMembers();
  const member = useMemo(
    () => members.find((m) => (m.name_en || '').toLowerCase() === (name || '').toLowerCase()),
    [members, name]
  );

  const { data, isLoading } = useMemberAllPhotos(member?.name_en);
  const photos = useMemo(
    () =>
      (data?.photos || []).map((p) => ({
        ...p,
        caption: `${(p.album_title || '').toUpperCase()}${p.concept_name ? ` — ${p.concept_name.toUpperCase()}` : ''}`,
      })),
    [data]
  );

  useDocumentTitle(member ? `${member.name} - PHOTOS` : undefined);

  const [filter, setFilter] = useState('all');
  const filtered = useMemo(
    () => (filter === 'all' ? photos : photos.filter((p) => p.photo_type === filter)),
    [photos, filter]
  );

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });

  if (isLoading || !member) return <Loading />;

  const typeCounts = photos.reduce((acc, p) => {
    acc[p.photo_type] = (acc[p.photo_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 헤더 */}
        <div className="border-b border-hairline pb-9 pt-14">
          <div className="text-[13px] font-extrabold tracking-k25 text-mute">
            <Link to="/members" className="hover:text-ink">MEMBERS</Link>
            <i className="not-italic mx-2 text-primary">/</i>
            <Link to={`/members/${(member.name_en || '').toLowerCase()}`} className="hover:text-ink">
              {member.name}
            </Link>
          </div>
          <h1 className="mt-3.5 text-[56px] font-black leading-none tracking-[-2.5px]">PHOTOS</h1>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 border-b border-hairline py-5">
          {[
            { key: 'all', label: `ALL ${photos.length}` },
            ...['group', 'unit', 'solo']
              .filter((t) => typeCounts[t])
              .map((t) => ({ key: t, label: `${TYPE_LABEL[t]} ${typeCounts[t]}` })),
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`border px-[18px] py-[9px] text-[13px] font-extrabold tracking-k15 transition-colors ${
                filter === f.key
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline text-esub hover:border-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="pt-[34px]">
          <JustifiedGallery
            photos={filtered}
            onPhotoClick={(p, i) => setLightbox({ open: true, index: i })}
          />
        </div>

        <Lightbox
          images={filtered.map((p) => p.medium_url)}
          currentIndex={lightbox.index}
          isOpen={lightbox.open}
          onClose={() => setLightbox((l) => ({ ...l, open: false }))}
          onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
        />
      </div>
    </div>
  );
}

export default MemberPhotos;
