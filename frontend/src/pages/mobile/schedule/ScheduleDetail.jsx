import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { getSchedule } from '@/api';
import { EASE } from '@/components/editorial';
import { useDocumentTitle } from '@/hooks/common';

// 섹션 컴포넌트들
import {
  MobileYoutubeSection,
  MobileXSection,
  MobileEventSection,
  MobileVarietySection,
  MobileConcertSection,
  MobileFansignSection,
  MobileTicketingSection,
  MobileEtcSection,
  MobileDefaultSection,
  decodeHtmlEntities,
} from './sections';

// 에디토리얼 리뉴얼 완료 섹션 (PC와 동일 범위)
const EDITORIAL_SECTIONS = {
  유튜브: MobileYoutubeSection,
  X: MobileXSection,
  행사: MobileEventSection,
  예능: MobileVarietySection,
  콘서트: MobileConcertSection,
  팬사인회: MobileFansignSection,
  티켓팅: MobileTicketingSection,
  기타: MobileEtcSection,
};

/**
 * Mobile 일정 상세 페이지 — 에디토리얼 리뉴얼 (design-drafts/D_final_*_mobile 시안)
 */
function MobileScheduleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 모바일 레이아웃 활성화
  useEffect(() => {
    document.documentElement.classList.add('mobile-layout');
    return () => {
      document.documentElement.classList.remove('mobile-layout');
    };
  }, []);

  const {
    data: schedule,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => getSchedule(id),
    placeholderData: keepPreviousData,
    retry: false,
  });

  useDocumentTitle(decodeHtmlEntities(schedule?.title));

  // 앨범 발매 일정은 앨범 상세로 리다이렉트
  useEffect(() => {
    if (schedule?.albumFolder) {
      navigate(`/album/${schedule.albumFolder}`, { replace: true });
    }
  }, [schedule?.albumFolder, navigate]);

  if (isLoading && !schedule) {
    return (
      <div className="mobile-layout-container bg-paper">
        <div className="mobile-content flex items-center justify-center">
          <span className="text-[14.5px] text-mute">로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="mobile-layout-container bg-paper text-ink">
        <div className="mobile-content flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full text-center"
          >
            <div className="text-[64px] font-black leading-none tracking-[-3px] text-faint-light">404</div>
            <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.4px]">일정을 찾을 수 없습니다</h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-mute">
              요청하신 일정이 존재하지 않거나
              <br />
              삭제되었을 수 있습니다.
            </p>
            <div className="mt-8 flex flex-col gap-2.5">
              <button
                onClick={() => window.history.back()}
                className="border border-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-ink"
              >
                ← 이전 페이지
              </button>
              <Link to="/schedule" className="bg-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white">
                일정 목록
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const categoryName = schedule.category?.name;
  const EditorialSection = EDITORIAL_SECTIONS[categoryName];

  // 헤더 카테고리 라벨 (행사 · 대학축제 등)
  const headerLabel =
    categoryName === '행사' && schedule.subtype === 'university' ? '행사 · 대학축제' : categoryName;

  // 헤더 (공통)
  const header = (
    <div className="flex shrink-0 items-center gap-3 border-b border-hairline bg-paper px-5 py-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        aria-label="뒤로 가기"
        className="-m-1 shrink-0 p-1 text-ink"
      >
        <ArrowLeft size={20} strokeWidth={2.2} />
      </button>
      <b className="text-[13.5px] font-extrabold tracking-k2" style={{ color: schedule.category?.color || '#141613' }}>
        {headerLabel}
      </b>
    </div>
  );

  // 에디토리얼 섹션: 페이퍼 배경 전체 레이아웃
  if (EditorialSection) {
    return (
      <div className="mobile-layout-container bg-paper text-ink">
        {header}
        <motion.div
          className="mobile-content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <EditorialSection schedule={schedule} />
        </motion.div>
      </div>
    );
  }

  // 기타 카테고리 — 에디토리얼 기본 섹션 (에디토리얼 섹션과 동일 레이아웃)
  return (
    <div className="mobile-layout-container bg-paper text-ink">
      {header}
      <motion.div
        className="mobile-content"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <MobileDefaultSection schedule={schedule} />
      </motion.div>
    </div>
  );
}

export default MobileScheduleDetail;
