import { motion, AnimatePresence } from 'framer-motion';

/**
 * Toast 컴포넌트
 * - 하단 중앙에 표시
 * - type: 'success' | 'error' | 'warning'
 */
function Toast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="alert"
          aria-live="polite"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          onClick={onClose}
          className="fixed inset-x-0 bottom-8 z-[9999] mx-auto flex w-fit cursor-pointer items-center gap-2.5 bg-ink/95 px-5 py-3 text-center text-[13.5px] font-bold text-white backdrop-blur-sm"
        >
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              toast.type === 'error'
                ? 'bg-[#E8836F]'
                : toast.type === 'warning'
                ? 'bg-[#E7C55E]'
                : 'bg-[#7FBD8F]'
            }`}
          />
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Toast;
