import { useParams, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getSchedule } from '@/api';

// 섹션 컴포넌트들
import { YoutubeSection, XSection, VarietySection, EventSection, FansignSection, ConcertSection, TicketingSection, EtcSection, DefaultSection, decodeHtmlEntities } from './sections';
import { useDocumentTitle } from '@/hooks/common';

/**
 * PC 일정 상세 페이지
 */
function PCScheduleDetail() {
  const { id } = useParams();

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

  if (isLoading) {
    return <div className="min-h-[calc(100dvh-64px)] bg-paper" />;
  }

  if (error || !schedule) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center bg-paper text-ink">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="px-6 text-center"
        >
          <div className="text-[120px] font-black leading-none tracking-[-6px] text-faint-light">404</div>
          <h2 className="mt-6 text-[28px] font-extrabold tracking-[-0.6px]">일정을 찾을 수 없습니다</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">
            요청하신 일정이 존재하지 않거나 삭제되었을 수 있습니다.
            <br />
            다른 일정을 확인해 주세요.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="border border-ink px-7 py-3 text-[13.5px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
            >
              ← 이전 페이지
            </button>
            <Link
              to="/schedule"
              className="bg-ink px-7 py-3 text-[13.5px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
            >
              일정 목록
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // 카테고리별 섹션 렌더링
  const categoryName = schedule.category?.name;

  // 에디토리얼 리뉴얼 완료 섹션: 자체 전체 레이아웃 사용 (구 래퍼 미적용)
  const EDITORIAL_SECTIONS = {
    유튜브: YoutubeSection,
    X: XSection,
    행사: EventSection,
    예능: VarietySection,
    콘서트: ConcertSection,
    팬사인회: FansignSection,
    티켓팅: TicketingSection,
    기타: EtcSection,
  };
  const EditorialSection = EDITORIAL_SECTIONS[categoryName];
  if (EditorialSection) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-paper text-ink">
        <EditorialSection schedule={schedule} />
      </div>
    );
  }

  // 기타 카테고리 — 에디토리얼 기본 섹션
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper text-ink">
      <DefaultSection schedule={schedule} />
    </div>
  );
}

export default PCScheduleDetail;
