import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { AdminLayout } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { EASE } from '@/components/editorial';

/**
 * 관리자 404 페이지 — 에디토리얼 리뉴얼
 */
function AdminNotFound() {
  const { user } = useAdminAuth();

  return (
    <AdminLayout user={user}>
      <div className="flex min-h-[calc(100dvh-200px)] flex-1 items-center justify-center">
        <div className="px-6 text-center">
          {/* 404 숫자 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <h1 className="select-none text-[150px] font-black leading-none tracking-[-4px] text-ink">
              4
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '2px #141613' }}
              >
                0
              </span>
              4
            </h1>
          </motion.div>

          {/* 메시지 */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5, ease: EASE }}
            className="mt-7"
          >
            <p className="text-[12px] font-extrabold tracking-k3 text-mute">PAGE NOT FOUND</p>
            <h2 className="mt-2.5 text-[22px] font-extrabold tracking-[-0.4px] text-ink">
              페이지를 찾을 수 없습니다
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-mute">
              요청하신 관리자 페이지가 존재하지 않거나 이동되었을 수 있습니다.
            </p>
          </motion.div>

          {/* 버튼들 */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.5, ease: EASE }}
            className="mt-10 flex justify-center gap-2"
          >
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 border border-hairline bg-white px-6 py-3 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
            >
              <ArrowLeft size={15} />
              이전 페이지
            </button>
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 bg-ink px-6 py-3 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody"
            >
              <Home size={15} />
              대시보드로 가기
            </Link>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminNotFound;
