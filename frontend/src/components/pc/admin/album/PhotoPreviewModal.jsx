/**
 * 사진/비디오 미리보기 모달 컴포넌트
 * body 포털로 렌더 — 페이지 스크롤 컨테이너(OverlayScrollbars) 위에 덮여
 * 스크롤바가 보이거나 배경이 스크롤되는 문제 방지
 */
import { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogBackClose } from '@/hooks/common';

/**
 * @param {Object} props
 * @param {Object|null} props.photo - 미리보기할 사진/비디오 객체
 * @param {Function} props.onClose - 닫기 핸들러
 */
const PhotoPreviewModal = memo(function PhotoPreviewModal({ photo, onClose }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(!!photo, onClose);

  return createPortal(
    <AnimatePresence>
      {photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/90"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          {photo.isVideo ? (
            <motion.video
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={photo.preview || photo.url}
              className="max-h-[92vh] max-w-[92vw] object-contain"
              onClick={(e) => e.stopPropagation()}
              controls
              autoPlay
            />
          ) : (
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={photo.preview || photo.url}
              alt={photo.filename}
              className="max-h-[92vh] max-w-[92vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});

export default PhotoPreviewModal;
