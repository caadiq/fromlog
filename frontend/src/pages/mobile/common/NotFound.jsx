import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * Mobile 404 페이지 — 에디토리얼
 */
function MobileNotFound() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-paper px-6 text-ink">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full text-center"
      >
        <div className="text-[96px] font-black leading-none tracking-[-4px] text-faint-light">404</div>
        <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.4px]">페이지를 찾을 수 없습니다</h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-mute">
          요청하신 페이지가 존재하지 않거나
          <br />
          이동되었을 수 있습니다.
        </p>
        <div className="mt-8 flex flex-col gap-2.5">
          <button
            onClick={() => window.history.back()}
            className="border border-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-ink"
          >
            ← 이전 페이지
          </button>
          <Link to="/" className="bg-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white">
            홈으로 가기
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default MobileNotFound;
