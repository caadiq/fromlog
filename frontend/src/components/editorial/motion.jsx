/**
 * 에디토리얼 공용 모션 — 절제된 페이드업 계열
 * whileInView 대신 react-intersection-observer 사용
 * (OverlayScrollbars 내부 스크롤 환경에서 framer whileInView가 발동하지 않음)
 */
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

export const EASE = [0.22, 1, 0.36, 1];

/** 아래에서 올라오며 나타나는 기본 리빌 */
export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

/** 자식 스태거 컨테이너 */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

/** 스크롤 진입 시 1회 리빌 */
export function Reveal({ children, className, variants = fadeUp, as = 'div' }) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '-60px 0px' });
  const Comp = motion[as] || motion.div;
  return (
    <Comp ref={ref} className={className} initial="hidden" animate={inView ? 'show' : 'hidden'} variants={variants}>
      {children}
    </Comp>
  );
}
