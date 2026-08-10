import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMembers, useDocumentTitle } from '@/hooks';
import { Loading } from '@/components/common';
import { motion } from 'framer-motion';
import { OutlineTitle, fadeUp, stagger, Reveal } from '@/components/editorial';

/**
 * PC 멤버 목록 — 에디토리얼 리뉴얼 (design-drafts/M_final_list_pc 시안)
 * 균등 3열×2줄 풀블리드 그리드, 6번째 빈 칸은 연한 워드마크 마감
 */
const MotionLink = motion(Link);

function Members() {
  useDocumentTitle('멤버');

  const { data: members = [], isLoading } = useMembers();
  const activeMembers = useMemo(() => members.filter((m) => !m.is_former), [members]);

  if (isLoading) return <Loading />;

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 페이지 헤더 */}
        <div className="border-b border-hairline pb-10 pt-16">
          <OutlineTitle solid="MEM" outline="BERS" className="text-[88px] tracking-[-4px]" />
        </div>

        {/* 균등 3열 × 2줄 그리드 */}
        <Reveal className="mt-10 grid grid-cols-3 border-b border-hairline" variants={stagger}>
          {activeMembers.map((m, i) => (
            <MotionLink
              key={m.id}
              variants={fadeUp}
              to={`/members/${(m.name_en || '').toLowerCase()}`}
              className={`group block cursor-pointer border-hairline pb-[30px] pl-[22px] pr-[22px] pt-[26px] transition-colors hover:bg-canvas ${
                i % 3 !== 2 ? 'border-r' : ''
              } ${i < 3 ? 'border-b' : ''}`}
            >
              <span className="text-[13.5px] font-bold text-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="mt-4 overflow-hidden">
                <img
                  src={m.image_medium || m.image_url}
                  alt={m.name}
                  className="block aspect-[0.82] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  style={{ filter: 'saturate(1.02)' }}
                />
              </div>
              <b className="mt-4 block text-[22px] font-black tracking-[-0.6px]">{m.name}</b>
              <span className="text-[12.5px] font-semibold tracking-k25 text-mute">
                {(m.name_en || '').toUpperCase()}
              </span>
              <div className="mt-2.5 flex items-center gap-[7px] text-[13px] text-esub">
                <i className="not-italic text-[12px] font-extrabold tracking-k1 text-primary">
                  BIRTH
                </i>
                {m.birth_date?.slice(0, 10).replaceAll('-', '. ')}
              </div>
            </MotionLink>
          ))}
          {/* 빈 칸 — 워드마크 마감 */}
          {activeMembers.length % 3 !== 0 && (
            <div className="flex items-center justify-center">
              <span className="text-[14.5px] font-extrabold tracking-k4 text-faint-light">
                fromis_9
              </span>
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
}

export default Members;
