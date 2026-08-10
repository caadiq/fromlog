/**
 * 슬롯머신 스타일 롤링 숫자 컴포넌트
 */
import { memo } from 'react';
import { motion } from 'framer-motion';

const AnimatedNumber = memo(function AnimatedNumber({ value, className = '' }) {
  const chars = String(value).split('');

  return (
    <span className={`inline-flex overflow-hidden ${className}`}>
      {chars.map((char, i) => (
        <span key={i} className="relative h-[1.2em] overflow-hidden">
          <motion.span
            className="flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: `-${parseInt(char) * 10}%` }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.8, delay: i * 0.1 }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span key={n} className="h-[1.2em] flex items-center justify-center">
                {n}
              </span>
            ))}
          </motion.span>
        </span>
      ))}
    </span>
  );
});

export default AnimatedNumber;
