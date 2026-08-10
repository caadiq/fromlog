import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMembers, useDocumentTitle, useMemberPhotos } from '@/hooks';
import { Loading, Lightbox } from '@/components/common';
import { motion } from 'framer-motion';
import { FactSheet, SectionHeader, fadeUp, stagger, Reveal } from '@/components/editorial';
import { nextBirthday } from '@/utils';

/**
 * PC 멤버 상세 — 에디토리얼 리뉴얼 신설 (design-drafts/M_final_detail_pc 시안)
 */
function MemberDetail() {
  const { name } = useParams();
  const { data: members = [], isLoading } = useMembers();

  const activeMembers = useMemo(() => members.filter((m) => !m.is_former), [members]);
  const member = useMemo(
    () => members.find((m) => (m.name_en || '').toLowerCase() === (name || '').toLowerCase()),
    [members, name]
  );

  const { data: photoData } = useMemberPhotos(member?.name_en);
  const photos = photoData?.photos || [];

  useDocumentTitle(member?.name);

  const bday = useMemo(() => nextBirthday(member?.birth_date), [member]);
  const [lightbox, setLightbox] = useState({ open: false, index: 0 });

  if (isLoading) return <Loading />;
  if (!member) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper py-40 text-mute">
        멤버를 찾을 수 없습니다
      </div>
    );
  }

  const instaId = member.instagram ? member.instagram.replace(/\/$/, '').split('/').pop() : null;

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 프로필 스프레드 */}
        <div className="grid grid-cols-[0.92fr_1.08fr] border-b border-hairline">
          <div className="relative border-r border-hairline">
            <img
              src={member.image_medium || member.image_url}
              alt={member.name}
              className="block h-full min-h-[640px] w-full object-cover"
              style={{ filter: 'saturate(1.02)' }}
            />
          </div>
          <div className="flex flex-col py-[64px] pl-[64px]">
            <div className="text-[13px] font-extrabold tracking-k25 text-mute">
              <Link to="/members" className="hover:text-ink">MEMBERS</Link>
              <i className="not-italic mx-2 text-primary">/</i>
              {member.name}
            </div>
            <h1 className="mt-5 text-[96px] font-black leading-none tracking-[-4.5px]">
              {member.name}
            </h1>
            <span className="mt-3.5 text-[14.5px] font-extrabold tracking-k5 text-primary">
              {(member.name_en || '').toUpperCase()}
            </span>
            <FactSheet
              className="mt-11"
              items={[
                { k: 'BIRTH', v: member.birth_date?.slice(0, 10).replaceAll('-', '. ') },
                ...(instaId
                  ? [
                      {
                        k: 'SNS',
                        v: (
                          <a
                            href={member.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-b border-primary"
                          >
                            @{instaId}
                          </a>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {bday && (
              <div className="mt-auto flex items-center gap-[18px] border border-hairline bg-white px-6 py-5">
                <b className="text-[30px] font-black tracking-[-1px] text-primary">{bday.dday}</b>
                <div>
                  <div className="text-[14.5px] font-semibold">다음 생일까지</div>
                  <div className="mt-0.5 text-[13px] text-mute">{bday.date}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RECENT PHOTOS — 멤버 태깅 컨셉 포토 자동 */}
        {photos.length > 0 && (
          <>
            <Reveal className="flex items-baseline justify-between pb-[22px] pt-14">
              <SectionHeader label="RECENT PHOTOS" />
              <Link
                to={`/members/${(member.name_en || '').toLowerCase()}/photos`}
                className="text-[13.5px] font-bold tracking-[0.5px] text-primary"
              >
                전체보기 →
              </Link>
            </Reveal>
            <Reveal className="flex gap-[18px]" variants={stagger}>
              {photos.map((p, i) => (
                <motion.button
                  variants={fadeUp}
                  key={p.id}
                  type="button"
                  onClick={() => setLightbox({ open: true, index: i })}
                  className="min-w-0 flex-1 text-left"
                >
                  <img
                    src={p.medium_url || p.thumb_url}
                    alt=""
                    className="block aspect-[0.8] w-full object-cover"
                    style={{ filter: 'saturate(1.02)' }}
                  />
                  <div className="mt-2 text-[13px] font-semibold tracking-k1 text-mute">
                    {(p.album_title || '').toUpperCase()}
                    {p.concept_name ? ` — ${p.concept_name.toUpperCase()}` : ''}
                  </div>
                </motion.button>
              ))}
            </Reveal>
            <Lightbox
              images={photos.map((p) => p.medium_url)}
              currentIndex={lightbox.index}
              isOpen={lightbox.open}
              onClose={() => setLightbox((l) => ({ ...l, open: false }))}
              onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default MemberDetail;
