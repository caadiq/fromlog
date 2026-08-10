import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * PC 404 페이지 — 에디토리얼
 */
function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-paper text-ink">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="px-6 text-center"
      >
        <div className="text-[160px] font-black leading-none tracking-[-8px] text-faint-light">404</div>
        <h2 className="mt-6 text-[28px] font-extrabold tracking-[-0.6px]">페이지를 찾을 수 없습니다</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          <br />
          주소를 다시 확인해 주세요.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="border border-ink px-7 py-3 text-[13.5px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
          >
            ← 이전 페이지
          </button>
          <Link
            to="/"
            className="bg-ink px-7 py-3 text-[13.5px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
          >
            홈으로 가기
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFound;
