import ContentState from '@/components/pc/public/ContentState';
import ContentImage from '@/components/editorial/ContentImage';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useMembers, useDocumentTitle, useMemberPhotos } from '@/hooks';
import { Loading, MobileLightbox } from '@/components/common';
import { fadeUp, stagger, Reveal } from '@/components/editorial';
import { nextBirthday } from '@/utils';

/**
 * 모바일 멤버 상세 — 에디토리얼 신설 (design-drafts/M_final_detail_mobile 시안)
 */
function MobileMemberDetail() {
  const { name } = useParams();
  const { data: members = [], isLoading, isError, refetch } = useMembers();

  const activeMembers = useMemo(() => members.filter((m) => !m.is_former), [members]);
  const member = useMemo(
    () => members.find((m) => (m.name_en || '').toLowerCase() === (name || '').toLowerCase()),
    [members, name]
  );
  const memberIndex = activeMembers.findIndex((m) => m.id === member?.id);

  const { data: photoData, isError: photosError, refetch: retryPhotos } = useMemberPhotos(member?.name_en, 3);
  const photos = photoData?.photos || [];

  useDocumentTitle(member?.name);

  const bday = useMemo(() => nextBirthday(member?.birth_date), [member]);
  const [lightbox, setLightbox] = useState({ open: false, index: 0 });

  const openLightbox = (index) => {
    setLightbox({ open: true, index });
  };

  if (isLoading) return <Loading className="min-h-0 flex-1 py-12" />;
  if (isError) return <ContentState onRetry={refetch}>멤버 정보를 불러오지 못했습니다.</ContentState>;
  if (!member) {
    return (
      <ContentState>멤버를 찾을 수 없습니다.</ContentState>
    );
  }

  const instaId = member.instagram ? member.instagram.replace(/\/$/, '').split('/').pop() : null;

  return (
    <>
      {/* 크럼 바 (고정) */}
      <div className="safe-area-top flex shrink-0 items-center gap-2 border-b border-hairline bg-paper px-3 py-2.5">
        <Link to="/members" className="p-2 text-esub active:text-ink" aria-label="멤버 목록으로">
          <ChevronLeft size={20} />
        </Link>
        <b className="text-[13.5px] font-extrabold tracking-k25 text-mute">
          MEMBERS{memberIndex >= 0 ? ` / ${String(memberIndex + 1).padStart(2, '0')}` : ''}
        </b>
      </div>

      {/* 스크롤 영역 */}
      <div className="mobile-content bg-paper text-ink break-words">
      {/* 대형 사진 */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
      <ContentImage
        src={member.image_medium || member.image_url}
        alt={member.name}
        className="block aspect-[0.82] w-full object-cover"
        style={{ filter: 'saturate(1.02)' }}
      />
      </motion.div>

      {/* 이름 + 팩트 */}
      <motion.div
        className="px-[22px] pb-2.5 pt-[26px]"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <motion.h1 variants={fadeUp} className="text-[44px] font-black leading-none tracking-[-2px]">
          {member.name}
        </motion.h1>
        <motion.span variants={fadeUp} className="mt-2 block text-[13px] font-extrabold tracking-k4 text-primary">
          {(member.name_en || '').toUpperCase()}
        </motion.span>
        <motion.div variants={fadeUp} className="mt-[26px] border-t-2 border-ink">
          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-baseline border-b border-hairline px-0.5 py-[13px]">
            <span className="text-[12px] font-extrabold tracking-k2 text-mute">BIRTH</span>
            <span className="text-[15px] font-semibold">
              {member.birth_date?.slice(0, 10).replaceAll('-', '. ')}
            </span>
          </div>
          {instaId && (
            <div className="grid grid-cols-[100px_minmax(0,1fr)] items-baseline border-b border-hairline px-0.5 py-[13px]">
              <span className="text-[12px] font-extrabold tracking-k2 text-mute">SNS</span>
              <span className="text-[15px] font-semibold">
                <a
                  href={member.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b-[1.5px] border-primary text-ink"
                >
                  @{instaId}
                </a>
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* 생일 D-day 카드 */}
      {bday && (
        <Reveal className="mx-[22px] my-5 flex items-center gap-[15px] border border-hairline bg-white px-[18px] py-4">
          <b className="text-[24px] font-black text-primary">{bday.dday}</b>
          <span>
            <span className="block text-[14px] font-semibold">다음 생일까지</span>
            <span className="mt-0.5 block text-[12.5px] text-mute">{bday.date}</span>
          </span>
        </Reveal>
      )}

      {photosError && <ContentState onRetry={retryPhotos}>사진을 불러오지 못했습니다.</ContentState>}
      {/* RECENT PHOTOS */}
      {photos.length > 0 && (
        <div className="px-[22px] pb-10 pt-4">
          <Reveal className="mb-3.5 flex items-baseline justify-between">
            <b className="text-[13px] font-extrabold tracking-k3">RECENT PHOTOS</b>
            <Link
              to={`/members/${(member.name_en || '').toLowerCase()}/photos`}
              className="text-[13px] font-bold text-primary"
            >
              더보기 →
            </Link>
          </Reveal>
          <Reveal className="flex gap-2.5" variants={stagger}>
            {photos.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                variants={fadeUp}
                aria-label={`사진 ${i + 1} 보기`}
                onClick={() => openLightbox(i)}
                className="min-w-0 flex-1"
              >
                <ContentImage
                  src={p.medium_url || p.thumb_url}
                  alt=""
                  className="block aspect-[0.8] w-full object-cover"
                  style={{ filter: 'saturate(1.02)' }}
                />
              </motion.button>
            ))}
          </Reveal>
        </div>
      )}
      </div>

      <MobileLightbox
        images={photos.map((p) => p.medium_url || p.thumb_url || p.original_url)}
        photos={photos.map((p) => ({ ...p, concept: p.concept_name, albumTitle: p.album_title }))}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((l) => ({ ...l, open: false }))}
        onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
      />
    </>
  );
}

export default MobileMemberDetail;
