/**
 * 일정 추가 페이지 (카테고리별 폼 분기) — 에디토리얼 리뉴얼 (design-drafts/ADM_schedule_new 시안)
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from '@/components/pc/admin/layout/Layout';
import { AdminPageHeader } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import * as categoriesApi from '@/api/admin/categories';
import CategorySelector from '@/components/pc/admin/schedule/CategorySelector';
import ScheduleForm from '../ScheduleForm';
import YouTubeForm from './YouTubeForm';
import XForm from './XForm';
import ConcertForm from './concert';
import VarietyForm from './VarietyForm';
import EventForm from './event';
import EtcForm from './etc';
import FansignForm from './FansignForm';
import TicketingForm from './TicketingForm';

/**
 * 일정 추가 페이지
 */
function ScheduleFormPage() {
  const { user, isAuthenticated } = useAdminAuth();
  useDocumentTitle('일정 추가');

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 카테고리 로드 (React Query)
  const { data: categories = [], isLoading: loading } = useQuery({
    queryKey: ['categories'], // 공개 일정(useScheduleData)과 캐시 공유
    queryFn: categoriesApi.getCategories,
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  // 자동 생성/계산 전용 카테고리는 수동 추가 폼에서 제외 (생일·기념일·앨범)
  const selectableCategories = useMemo(
    () => categories.filter((c) => c.name !== '생일' && c.name !== '기념일' && c.name !== '앨범'),
    [categories]
  );

  // 카테고리 로드 시 기본값 설정 (선택 가능한 카테고리 기준)
  useEffect(() => {
    if (selectableCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(selectableCategories[0].id);
    }
  }, [selectableCategories, selectedCategory]);

  // 카테고리에 따른 폼 렌더링
  const renderForm = () => {
    const selectedCategoryName = categories.find((c) => c.id === selectedCategory)?.name;

    switch (selectedCategoryName) {
      case '유튜브':
        return <YouTubeForm />;

      case 'X':
        return <XForm />;

      case '콘서트':
        return <ConcertForm />;

      case '예능':
        return <VarietyForm />;

      case '행사':
        return <EventForm />;

      case '팬사인회':
        return <FansignForm inline key={selectedCategory} />;

      case '티켓팅':
        return <TicketingForm inline key={selectedCategory} />;

      // 기타: 장소·포스터·설명을 갖춘 공용 폼
      case '기타':
        return <EtcForm key={selectedCategory} />;

      // 컴백: 공용 기본 폼을 인라인으로
      case '컴백':
        return <ScheduleForm inline categoryId={selectedCategory} key={selectedCategory} />;

      default:
        return (
          <div className="py-16 text-center text-[14.5px] text-mute">
            이 카테고리의 전용 폼은 준비 중입니다.
          </div>
        );
    }
  };

  if (loading) {
    return (
      <AdminLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <span className="text-[14.5px] text-mute">로딩 중...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / SCHEDULE / NEW" solid="NEW " outline="SCHEDULE" />
        </motion.div>

        {/* 카테고리 선택 */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          <CategorySelector
            categories={selectableCategories}
            selectedId={selectedCategory}
            onChange={(id) => {
              setSelectedCategory(id);
              setIsInitialLoad(false);
            }}
          />
        </motion.div>

        {/* 카테고리별 폼 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            className="mt-9"
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                duration: isInitialLoad ? 0.4 : 0.15,
                ease: 'easeOut',
                delay: isInitialLoad ? 0.2 : 0,
              },
            }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}
          >
            {renderForm()}
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}

export default ScheduleFormPage;
