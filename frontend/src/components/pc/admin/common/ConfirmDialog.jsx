/**
 * ConfirmDialog 컴포넌트 — 에디토리얼 리뉴얼
 * 삭제 등 위험한 작업의 확인을 위한 공통 다이얼로그
 *
 * Props:
 * - isOpen: 다이얼로그 표시 여부
 * - onClose: 닫기 콜백
 * - onConfirm: 확인 콜백
 * - title: 제목 (예: "앨범 삭제")
 * - message: 메시지 내용 (ReactNode 가능)
 * - confirmText: 확인 버튼 텍스트 (기본: "삭제")
 * - cancelText: 취소 버튼 텍스트 (기본: "취소")
 * - loading: 로딩 상태
 * - loadingText: 로딩 중 텍스트 (기본: "삭제 중...")
 * - variant: 버튼 색상 (기본: "danger", "primary" 가능)
 */
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialogBackClose } from '@/hooks/common';

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '삭제',
  cancelText = '취소',
  loading = false,
  loadingText = '삭제 중...',
  variant = 'danger',
}) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const confirmColors = {
    danger: 'bg-[#C0392B] hover:bg-[#A93226]',
    primary: 'bg-ink hover:bg-ebody',
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !loading && onClose()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="mx-4 w-full max-w-sm border border-ink bg-white p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">{title}</h3>
            <div className="mt-2 text-[14px] leading-relaxed text-mute">{message}</div>

            <div className="mt-7 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors disabled:opacity-50 ${confirmColors[variant]}`}
              >
                {loading && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {loading ? loadingText : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ConfirmDialog;
