/**
 * 관리자 대시보드 — 에디토리얼 리뉴얼 (design-drafts/ADM_dashboard 시안)
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AdminLayout, AdminPageHeader } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminStatsApi } from '@/api/admin';

/**
 * 슬롯머신 스타일 롤링 숫자 컴포넌트
 */
function AnimatedNumber({ value }) {
  const formatted = value.toLocaleString();
  const chars = formatted.split('');

  return (
    <span className="inline-flex overflow-hidden">
      {chars.map((char, i) => {
        if (char === ',') {
          return (
            <motion.span
              key={i}
              className="flex h-[1.2em] items-center"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.8, delay: i * 0.15 }}
            >
              ,
            </motion.span>
          );
        }

        return (
          <span key={i} className="relative h-[1.2em] overflow-hidden">
            <motion.span
              className="flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: `-${parseInt(char) * 10}%` }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.8, delay: i * 0.15 }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <span key={n} className="flex h-[1.2em] items-center justify-center">
                  {n}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

const STATS = [
  { key: 'members', label: 'MEMBERS' },
  { key: 'albums', label: 'ALBUMS' },
  { key: 'photos', label: 'PHOTOS' },
  { key: 'schedules', label: 'SCHEDULES' },
];

// 상단 내비에 없는 메뉴만 둔다. 멤버·앨범·영상·일정은 헤더에서 바로 간다.
const MENU = [
  { en: 'THEME', ko: '테마 컬러', description: '앨범 커버색 자동 · 수동 테마 지정', path: '/admin/theme' },
  { en: 'LOGS', ko: '활동 로그', description: '관리자 · 봇의 모든 활동 기록 열람', path: '/admin/logs' },
];

function AdminDashboard() {
  useDocumentTitle('대시보드');
  const { user, isAuthenticated } = useAdminAuth();

  // 통계 조회
  const { data: stats = { members: 0, albums: 0, photos: 0, schedules: 0 } } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminStatsApi.getStats,
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-[1280px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / DASHBOARD" solid="DASH" outline="BOARD" />
        </motion.div>

        {/* 통계 */}
        <motion.div
          className="mt-9 grid grid-cols-4 border-t-2 border-ink"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.key}
              className={`border-b border-hairline py-6 pr-1.5 ${i > 0 ? 'border-l pl-7' : 'pl-1.5'}`}
            >
              <div className="text-[12px] font-extrabold tracking-k25 text-mute">{s.label}</div>
              <b
                className="mt-2.5 block text-[44px] font-black leading-none tracking-[-2px]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                <AnimatedNumber value={stats[s.key]} />
              </b>
            </div>
          ))}
        </motion.div>

        {/* 메뉴 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.16 }}
        >
          <div className="mt-[52px] text-[13px] font-extrabold tracking-k3">MENU</div>
          {/* 항목이 2개뿐이어도 4칸 기준을 유지한다 — 빈 칸이 자리를 차지해 카드가 길어지지 않는다 */}
          <div className="mt-4 grid grid-cols-4 gap-3.5">
            {MENU.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group relative block border border-hairline bg-white px-6 pb-[22px] pt-[26px] transition-colors hover:border-ink"
              >
                <div className="text-[16px] font-black tracking-k1">{item.en}</div>
                <div className="mt-[3px] text-[14px] font-bold text-ebody">{item.ko}</div>
                <p className="mt-3.5 text-[13px] leading-[1.6] text-mute">{item.description}</p>
                <span className="absolute right-5 top-6 text-[16px] text-faint transition-colors group-hover:text-ink">
                  →
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}

export default AdminDashboard;
