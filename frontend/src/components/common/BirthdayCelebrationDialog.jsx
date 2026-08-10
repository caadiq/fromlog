import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogBackClose } from '@/hooks/common';

/**
 * 생일 축하 다이얼로그
 * @param {boolean} isOpen - 다이얼로그 표시 여부
 * @param {function} onClose - 닫기 핸들러
 * @param {string} title - 제목 (예: HAPPY Jiwon DAY)
 * @param {string} memberImage - 멤버 이미지 URL
 * @param {string} date - 생일 날짜 (YYYY-MM-DD)
 */
const BirthdayCelebrationDialog = memo(function BirthdayCelebrationDialog({
  isOpen,
  onClose,
  title = '',
  memberImage = '',
  date = '',
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

  const dateObj = date ? new Date(date) : new Date();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

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
              <span className="text-[12px] font-extrabold tracking-k25 text-primary">BIRTHDAY</span>

              {/* 멤버 사진 */}
              <div className="mt-5 h-28 w-28 overflow-hidden rounded-full border border-hairline bg-canvas-deep">
                {memberImage && (
                  <img src={memberImage} alt={title} className="h-full w-full object-cover" />
                )}
              </div>

              {/* 텍스트 */}
              <h2 className="mt-6 text-[26px] font-extrabold leading-[1.25] tracking-[-0.6px] text-ink">
                {title}
              </h2>
              <p className="mt-2.5 text-[14px] font-bold tracking-k1 text-mute">
                {month}. {day}.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default BirthdayCelebrationDialog;
