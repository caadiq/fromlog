import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMembers, useDocumentTitle } from '@/hooks';
import { OutlineTitle, fadeUp, stagger, Reveal } from '@/components/editorial';

const MotionLink = motion(Link);

/**
 * 모바일 멤버 목록 — 에디토리얼 리뉴얼 (design-drafts/M_final_list_mobile 시안)
 */
function MobileMembers() {
  useDocumentTitle('멤버');

  const { data: members = [] } = useMembers();
  const activeMembers = members.filter((m) => !m.is_former);

  return (
    <div className="bg-paper text-ink">
      {/* 페이지 헤더 */}
      <motion.div
        className="border-b border-hairline px-[22px] pb-6 pt-[30px]"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <OutlineTitle solid="MEM" outline="BERS" className="text-[46px] tracking-[-2px]" />
        </motion.div>
      </motion.div>

      {/* 멤버 리스트 */}
      <Reveal className="px-[22px] pb-8 pt-1.5" variants={stagger}>
        {activeMembers.map((m, i) => (
          <MotionLink
            key={m.id}
            to={`/members/${(m.name_en || '').toLowerCase()}`}
            variants={fadeUp}
            className="flex items-center gap-4 border-b border-hairline py-4"
          >
            <span className="w-[22px] text-[13px] font-extrabold text-faint">
              {String(i + 1).padStart(2, '0')}
            </span>
            <img
              src={m.image_thumb || m.image_medium}
              alt={m.name}
              className="h-16 w-16 rounded-full object-cover"
            />
            <span className="min-w-0 flex-1">
              <b className="block text-[17.5px] font-extrabold tracking-[-0.3px]">{m.name}</b>
              <span className="text-[12px] font-bold tracking-k2 text-mute">
                {(m.name_en || '').toUpperCase()}
              </span>
              <span className="mt-1 block text-[13px] text-esub">
                {m.birth_date?.slice(0, 10).replaceAll('-', '. ')}
              </span>
            </span>
            <span className="text-[16px] text-faint">→</span>
          </MotionLink>
        ))}
      </Reveal>
    </div>
  );
}

export default MobileMembers;
