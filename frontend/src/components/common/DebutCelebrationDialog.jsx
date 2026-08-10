import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Fromis9Logo from './Fromis9Logo';
import { useDialogBackClose } from '@/hooks/common';

/**
 * 데뷔/주년 축하 다이얼로그
 * @param {boolean} isOpen - 다이얼로그 표시 여부
 * @param {function} onClose - 닫기 핸들러
 * @param {boolean} isDebut - 데뷔일 여부 (false면 주년)
 * @param {number} anniversaryYear - 주년 수 (isDebut이 false일 때)
 */
const DebutCelebrationDialog = memo(function DebutCelebrationDialog({
  isOpen,
  onClose,
  isDebut = false,
  anniversaryYear = 0,
}) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />

          {/* 다이얼로그 */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm border border-hairline bg-paper text-ink shadow-[0_30px_80px_rgba(20,22,19,0.35)]"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute right-3.5 top-3.5 z-10 p-1.5 text-mute transition-colors hover:text-ink"
              aria-label="닫기"
            >
              <X size={18} />
            </button>

            {/* 컨텐츠 */}
            <div className="flex flex-col items-center px-8 pb-11 pt-12 text-center">
              <span className="text-[12px] font-extrabold tracking-k25 text-primary">
                {isDebut ? 'DEBUT' : 'ANNIVERSARY'}
              </span>

              {/* 로고/숫자 */}
              <div className="mt-5 flex h-28 w-28 items-center justify-center rounded-full border border-hairline bg-canvas-deep">
                {isDebut ? (
                  <Fromis9Logo size={52} fill="#141613" />
                ) : (
                  <div className="text-center">
                    <div className="text-[40px] font-black leading-none text-ink">{anniversaryYear}</div>
                    <div className="text-[12px] font-bold tracking-k15 text-mute">YEARS</div>
                  </div>
                )}
              </div>

              {/* 텍스트 */}
              <h2 className="mt-6 text-[24px] font-extrabold leading-[1.3] tracking-[-0.6px] text-ink">
                {isDebut ? '프로미스나인 데뷔' : `프로미스나인 데뷔 ${anniversaryYear}주년`}
              </h2>
              <p className="mt-2.5 text-[14px] font-bold tracking-k1 text-mute">2018. 01. 24</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default DebutCelebrationDialog;
