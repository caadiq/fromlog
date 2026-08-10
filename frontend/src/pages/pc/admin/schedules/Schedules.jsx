/**
 * 관리자 일정 관리 — 에디토리얼 리뉴얼 (design-drafts/ADM_schedule 시안)
 */
import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { Calendar, ChevronLeft, ChevronRight, Search, ArrowLeft, Tag } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Toast } from '@/components/common';
import { AdminLayout, ConfirmDialog, AdminPageHeader, YearMonthPicker } from '@/components/pc/admin';
import { ScheduleItem } from '@/components/pc/admin/schedule';
import useScheduleStore from '@/stores/useScheduleStore';
import { useAdminAuth, useScheduleSearch } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { getTodayKST, formatDate } from '@/utils';
import { getCategoryId } from '@/utils/schedule';
import { EASE } from '@/components/editorial';
import * as schedulesApi from '@/api/admin/schedules';
import { getPendingCount } from '@/api/admin/pending';
import { getColorStyle } from '@/utils/color';
import { WEEKDAYS, WEEKDAYS_LONG } from '@/constants';

const GREEN = 'rgb(var(--c-primary))';

/** 목록 오버레이 스크롤바 — 페이지 스크롤바와 같은 테마 */
const OS_LIST_OPTIONS = {
  scrollbars: { theme: 'os-theme-fromis', autoHide: 'leave', autoHideDelay: 600, clickScroll: 'instant' },
};

function Schedules() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Zustand 스토어에서 상태 가져오기 (검색 제외)
  const {
    selectedCategories,
    setSelectedCategories,
    selectedDate,
    setSelectedDate,
    currentDate,
    setCurrentDate,
    scrollPosition,
    setScrollPosition,
  } = useScheduleStore();

  const { user, isAuthenticated } = useAdminAuth();
  useDocumentTitle('일정 관리');

  // 수집 큐 대기 건수 (배지)
  const { data: pendingCountData } = useQuery({
    queryKey: ['pending-count'],
    queryFn: getPendingCount,
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const pendingCount = pendingCountData?.count || 0;

  // 검색 관련 (커스텀 훅)
  const {
    searchInput,
    searchTerm,
    isSearchMode,
    setIsSearchMode,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    suggestions,
    isLoadingSuggestions,
    searchResults,
    searchLoading,
    hasNextPage,
    isFetchingNextPage,
    handleSearch,
    exitSearchMode,
    handleSearchInputChange,
    handleSuggestionSelect,
    handleKeyDown: handleSearchKeyDown,
    loadMoreRef,
  } = useScheduleSearch();

  // 로컬 상태 (페이지 이동 시 유지할 필요 없는 것들)
  const { toast, setToast } = useToast();
  const scrollContainerRef = useRef(null);
  const searchContainerRef = useRef(null); // 검색 컨테이너 (외부 클릭 감지용)

  const ESTIMATED_ITEM_HEIGHT = 100; // 아이템 추정 높이 (동적 측정)

  // selectedDate가 없으면 오늘 날짜로 초기화
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(getTodayKST());
    }
  }, []);

  const [slideDirection, setSlideDirection] = useState(0);
  const [editMode, setEditMode] = useState(false); // 편집 모드 (수정/삭제 버튼 표시)

  // 년월 선택 관련
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [showCategoryTooltip, setShowCategoryTooltip] = useState(false);
  const pickerRef = useRef(null);
  const categoryTooltipRef = useRef(null);

  // 달력 관련
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  // 일정 목록 (React Query로 캐싱)
  const { data: schedules = [], isLoading: loading } = useQuery({
    queryKey: ['adminSchedules', year, month + 1],
    queryFn: () => schedulesApi.getSchedules(year, month + 1),
    enabled: isAuthenticated,
  });

  // 카테고리는 일정 데이터에서 추출
  const categories = useMemo(() => {
    const categoryMap = new Map();
    schedules.forEach((s) => {
      if (s.category_id && !categoryMap.has(s.category_id)) {
        categoryMap.set(s.category_id, {
          id: s.category_id,
          name: s.category_name,
          color: s.category_color,
        });
      }
    });
    return [{ id: 'all', name: '전체', color: 'gray' }, ...Array.from(categoryMap.values())];
  }, [schedules]);

  // 일정 데이터를 지연 처리하여 달력 UI 응답성 향상
  const deferredSchedules = useDeferredValue(schedules);

  useEffect(() => {
    if (!isAuthenticated) return;

    // sessionStorage에서 토스트 메시지 확인 (일정 추가/수정 완료 시)
    const savedToast = sessionStorage.getItem('scheduleToast');
    if (savedToast) {
      setToast(JSON.parse(savedToast));
      sessionStorage.removeItem('scheduleToast');
      // 추가/수정 후 돌아왔을 때 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['adminSchedules'] });
    }
  }, [isAuthenticated, queryClient]);

  // 스크롤 위치 복원
  useEffect(() => {
    if (scrollContainerRef.current && scrollPosition > 0) {
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [loading]); // 로딩이 끝나면 스크롤 복원

  // 날짜 변경 시 스크롤 맨 위로 초기화
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedDate]);

  // 외부 클릭 시 피커 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowYearMonthPicker(false);
      }
      if (categoryTooltipRef.current && !categoryTooltipRef.current.contains(event.target)) {
        setShowCategoryTooltip(false);
      }
      // 검색 추천 드롭다운 외부 클릭 시 닫기
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    if (showYearMonthPicker || showCategoryTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showYearMonthPicker, showCategoryTooltip]);

  // 2017년 1월 이전으로 이동 불가
  const canGoPrevMonth = !(year === 2017 && month === 0);

  // 월 이동 후 선택 날짜 보정 (이번달이면 오늘, 다른 달이면 1일)
  const applyMonth = (newDate) => {
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedDate(getTodayKST());
    } else {
      setSelectedDate(
        `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`
      );
    }
  };

  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    setSlideDirection(-1);
    applyMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setSlideDirection(1);
    applyMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setSlideDirection(0);
    setCurrentDate(new Date());
    setSelectedDate(getTodayKST());
  };

  // 년도 선택
  const selectYear = (newYear) => {
    setCurrentDate(new Date(newYear, month, 1));
  };

  // 월 선택 시 적용 후 닫기
  const selectMonth = (newMonth) => {
    applyMonth(new Date(year, newMonth, 1));
    setShowYearMonthPicker(false);
  };

  // 날짜 선택 (토글 없이 항상 선택)
  const selectDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  // 삭제 관련 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 삭제 확인 다이얼로그 열기
  const openDeleteDialog = (schedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  // 일정 삭제
  const handleDelete = async () => {
    if (!scheduleToDelete) return;

    setDeleting(true);
    try {
      await schedulesApi.deleteSchedule(scheduleToDelete.id);
      setToast({ type: 'success', message: '일정이 삭제되었습니다.' });
      // 캐시 무효화하여 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['adminSchedules', year, month + 1] });
    } catch (error) {
      console.error('삭제 오류:', error);
      setToast({ type: 'error', message: error.message || '삭제 중 오류가 발생했습니다.' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  };

  // 일정 목록 (검색 모드일 때 searchResults, 일반 모드일 때 로컬 필터링) - useMemo로 최적화
  const filteredSchedules = useMemo(() => {
    let result;
    if (isSearchMode) {
      if (!searchTerm) return [];
      // 카테고리 필터링 적용
      if (selectedCategories.length === 0) {
        result = [...searchResults];
      } else {
        result = searchResults.filter((s) => selectedCategories.includes(getCategoryId(s)));
      }
    } else {
      // 일반 모드: 로컬 필터링 (날짜 미정은 별도 그룹으로)
      result = schedules.filter((schedule) => {
        if (schedule.datePrecision === 'month') return false;
        const matchesCategory =
          selectedCategories.length === 0 || selectedCategories.includes(schedule.category_id);
        const scheduleDate = formatDate(schedule.date);
        const matchesDate = !selectedDate || scheduleDate === selectedDate;
        return matchesCategory && matchesDate;
      });
    }
    // 생일 일정을 맨 위로 정렬
    return result.sort((a, b) => {
      const aIsBirthday = a.is_birthday || String(a.id).startsWith('birthday-');
      const bIsBirthday = b.is_birthday || String(b.id).startsWith('birthday-');
      if (aIsBirthday && !bIsBirthday) return -1;
      if (!aIsBirthday && bIsBirthday) return 1;
      return 0;
    });
  }, [isSearchMode, searchTerm, searchResults, schedules, selectedCategories, selectedDate]);

  // 날짜 미정(월만 확정) 일정 — 선택 날짜와 무관하게 해당 달이면 하단에 표시
  const undatedSchedules = useMemo(() => {
    if (isSearchMode) return [];
    return schedules.filter((s) => {
      if (s.datePrecision !== 'month') return false;
      return selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
    });
  }, [isSearchMode, schedules, selectedCategories]);

  // 가상 스크롤 설정 (검색 모드에서만 활성화, 동적 높이 지원)
  const virtualizer = useVirtualizer({
    count: isSearchMode && searchTerm ? filteredSchedules.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5, // 버퍼 아이템 수
  });

  // 카테고리별 카운트 맵 (선택 날짜와 무관하게 해당 달 전체 기준)
  const categoryCounts = useMemo(() => {
    // 검색어가 있을 때만 검색 결과 사용, 아니면 기존 schedules 사용
    const source = isSearchMode && searchTerm ? searchResults : schedules;
    const counts = new Map();
    let total = 0;

    source.forEach((s) => {
      const catId = getCategoryId(s);
      counts.set(catId, (counts.get(catId) || 0) + 1);
      total++;
    });

    counts.set('total', total);
    return counts;
  }, [schedules, searchResults, isSearchMode, searchTerm]);

  // 정렬된 카테고리 목록 (메모이제이션으로 깜빡임 방지)
  const sortedCategories = useMemo(() => {
    const total = categoryCounts.get('total') || 0;

    return categories
      .map((category) => ({
        ...category,
        count: category.id === 'all' ? total : categoryCounts.get(category.id) || 0,
      }))
      .filter((category) => category.id === 'all' || category.count > 0)
      .sort((a, b) => {
        if (a.id === 'all') return -1;
        if (b.id === 'all') return 1;
        if (a.name === '기타') return 1;
        if (b.name === '기타') return -1;
        return b.count - a.count;
      });
  }, [categories, categoryCounts]);

  // 카테고리 점 색상
  const dotColor = (category) =>
    category.id === 'all'
      ? '#9B9E96'
      : getColorStyle(category.color)?.style?.backgroundColor || category.color || '#6b7280';

  // 선택 날짜 표기
  const selDateObj = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="일정 삭제"
        message={
          <>
            <p className="mb-2">다음 일정을 삭제하시겠습니까?</p>
            <p className="mb-4 border border-hairline bg-paper p-3 font-extrabold text-ink">
              {scheduleToDelete?.title}
            </p>
            <p className="text-[12.5px] font-bold text-[#C0392B]">이 작업은 되돌릴 수 없습니다.</p>
          </>
        }
        loading={deleting}
      />

      {/* 메인 콘텐츠 - 전체 높이 차지 */}
      <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col overflow-hidden px-10 pb-6 pt-[44px]">
        {/* 크럼 + 타이틀 + 액션 */}
        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader
            crumb="ADMIN / SCHEDULE"
            solid="SCHE"
            outline="DULE"
            right={
              <>
                <button
                  onClick={() => navigate('/admin/schedule/dict')}
                  className="border border-hairline bg-white px-[18px] py-[11px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
                >
                  사전 관리
                </button>
                <button
                  onClick={() => navigate('/admin/schedule/queue')}
                  className="relative border border-hairline bg-white px-[18px] py-[11px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
                >
                  큐 관리
                  {pendingCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#C0392B] px-1 text-[11px] font-extrabold text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => navigate('/admin/schedule/bots')}
                  className="border border-hairline bg-white px-[18px] py-[11px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
                >
                  봇 관리
                </button>
                <button
                  onClick={() => navigate('/admin/schedule/new')}
                  className="bg-ink px-5 py-[11px] text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
                >
                  + 일정 추가
                </button>
              </>
            }
          />
        </motion.div>

        {/* 스프레드: 달력·필터 | 일정 리스트 */}
        <motion.div
          className="mt-8 grid min-h-0 flex-1 grid-cols-[1fr_1.15fr] border-t-2 border-ink"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          {/* 왼쪽: 달력 + 카테고리 필터 */}
          <div className="min-h-0 overflow-y-auto border-r border-hairline py-7 pl-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <motion.div
              ref={pickerRef}
              animate={{ opacity: isSearchMode ? 0.4 : 1 }}
              transition={{ duration: 0.2 }}
              className={`relative ${isSearchMode ? 'pointer-events-none' : ''}`}
            >
              {/* 달력 헤더 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={prevMonth}
                  disabled={isSearchMode || !canGoPrevMonth}
                  aria-label="이전 달"
                  className={`-m-1 p-1 transition-colors ${
                    isSearchMode || !canGoPrevMonth ? 'text-faint' : 'text-esub hover:text-ink'
                  }`}
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => !isSearchMode && setShowYearMonthPicker(!showYearMonthPicker)}
                  disabled={isSearchMode}
                  className={`flex items-baseline gap-1.5 text-[24px] font-black tracking-[-1px] transition-colors ${
                    showYearMonthPicker ? 'text-primary' : 'hover:text-primary'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {year}. {month + 1}
                  <span className="text-[13px] text-primary">▾</span>
                </button>
                <button
                  onClick={nextMonth}
                  disabled={isSearchMode}
                  aria-label="다음 달"
                  className="-m-1 p-1 text-esub transition-colors hover:text-ink"
                >
                  <ChevronRight size={20} strokeWidth={2.5} />
                </button>
                <button
                  onClick={goToToday}
                  disabled={isSearchMode}
                  className="ml-auto text-[12px] font-extrabold tracking-k2 text-mute transition-colors hover:text-ink"
                >
                  TODAY
                </button>
              </div>

              {/* 년/월 선택 팝업 */}
              <YearMonthPicker
                open={showYearMonthPicker}
                year={year}
                month={month}
                minYear={2017}
                onSelectYear={selectYear}
                onSelectMonth={selectMonth}
              />

              {/* 요일 헤더 + 날짜 그리드 */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${year}-${month}`}
                  initial={{ opacity: 0, x: slideDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: slideDirection * -20 }}
                  transition={{ duration: 0.08 }}
                >
                  {/* 요일 헤더 */}
                  <div className="mb-1 mt-5 grid grid-cols-7">
                    {WEEKDAYS.map((day, i) => (
                      <div
                        key={day}
                        className={`py-2 text-center text-[12px] font-extrabold tracking-[1.5px] ${
                          i === 0 ? 'text-cal-sun' : i === 6 ? 'text-cal-sat' : 'text-mute'
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* 날짜 그리드 */}
                  <div className="grid grid-cols-7 border-l border-t border-hairline">
                    {/* 전달 날짜 */}
                    {Array.from({ length: firstDay }).map((_, i) => {
                      const prevMonthDays = getDaysInMonth(year, month - 1);
                      const day = prevMonthDays - firstDay + i + 1;
                      return (
                        <div
                          key={`prev-${i}`}
                          className="flex aspect-square items-center justify-center border-b border-r border-hairline text-[14.5px] font-medium text-faint-light"
                        >
                          {day}
                        </div>
                      );
                    })}

                    {/* 현재 달 날짜 */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSelected = selectedDate === dateStr;
                      const dayOfWeek = (firstDay + i) % 7;
                      const isToday =
                        new Date().toDateString() === new Date(year, month, day).toDateString();

                      // 해당 날짜의 일정 목록 (점 표시용, 최대 3개) - 카테고리 필터 반영
                      const daySchedules = deferredSchedules
                        .filter((s) => {
                          if (s.datePrecision === 'month') return false; // 날짜 미정은 점 제외
                          const scheduleDate = s.date ? s.date.split('T')[0] : '';
                          const matchesDate = scheduleDate === dateStr;
                          const matchesCategory =
                            selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
                          return matchesDate && matchesCategory;
                        })
                        .slice(0, 3);

                      return (
                        <button
                          key={day}
                          onClick={() => !isSearchMode && selectDate(day)}
                          disabled={isSearchMode}
                          className={`flex aspect-square flex-col items-center justify-center gap-[3px] border-b border-r border-hairline text-[14.5px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-ink text-white'
                              : dayOfWeek === 0
                                ? 'text-cal-sun'
                                : dayOfWeek === 6
                                  ? 'text-cal-sat'
                                  : 'text-ebody'
                          } ${isSearchMode ? 'cursor-not-allowed' : ''}`}
                          style={isToday && !isSelected ? { boxShadow: `inset 0 0 0 1.5px ${GREEN}` } : undefined}
                        >
                          {day}
                          <span className="flex h-[5px] gap-[3px]">
                            {daySchedules.map((schedule, idx) => (
                              <span
                                key={idx}
                                className="block h-[5px] w-[5px] rounded-full"
                                style={{
                                  backgroundColor: isSelected
                                    ? '#fff'
                                    : getColorStyle(
                                        categories.find((c) => c.id === schedule.category_id)?.color
                                      )?.style?.backgroundColor || '#6b7280',
                                }}
                              />
                            ))}
                          </span>
                        </button>
                      );
                    })}

                    {/* 다음달 날짜 */}
                    {(() => {
                      const totalCells = firstDay + daysInMonth;
                      const remainder = totalCells % 7;
                      const nextDays = remainder === 0 ? 0 : 7 - remainder;
                      return Array.from({ length: nextDays }).map((_, i) => (
                        <div
                          key={`next-${i}`}
                          className="flex aspect-square items-center justify-center border-b border-r border-hairline text-[14.5px] font-medium text-faint-light"
                        >
                          {i + 1}
                        </div>
                      ));
                    })()}
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* 카테고리 필터 칩 */}
            <motion.div
              animate={{ opacity: isSearchMode && !searchTerm ? 0.4 : 1 }}
              transition={{ duration: 0.2 }}
              className={`mt-6 flex flex-wrap gap-1.5 border-t border-hairline pt-[22px] ${
                isSearchMode && !searchTerm ? 'pointer-events-none' : ''
              }`}
            >
              {sortedCategories.map((category) => {
                const isSelected =
                  category.id === 'all'
                    ? selectedCategories.length === 0
                    : selectedCategories.includes(category.id);

                const handleClick = () => {
                  if (category.id === 'all') {
                    setSelectedCategories([]);
                  } else {
                    if (selectedCategories.includes(category.id)) {
                      setSelectedCategories(selectedCategories.filter((id) => id !== category.id));
                    } else {
                      setSelectedCategories([...selectedCategories, category.id]);
                    }
                  }
                };

                return (
                  <button
                    key={category.id}
                    onClick={handleClick}
                    className={`flex items-center gap-1.5 border px-3 py-2 text-[12.5px] font-extrabold tracking-[0.5px] transition-colors ${
                      isSelected
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-esub hover:border-ink'
                    }`}
                  >
                    {category.id !== 'all' && (
                      <i
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#fff' : dotColor(category) }}
                      />
                    )}
                    {category.name} {category.count}
                  </button>
                );
              })}
            </motion.div>
          </div>

          {/* 오른쪽: 일정 목록 */}
          <div className="flex min-h-0 min-w-0 flex-col py-7 pl-10 pr-1">
            {/* 리스트 헤더 */}
            <div className="shrink-0 border-b-2 border-ink pb-3">
              <AnimatePresence mode="wait">
                {isSearchMode ? (
                  /* 검색 모드 */
                  <motion.div
                    key="search-mode"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex items-center gap-3.5"
                  >
                    <button
                      onClick={exitSearchMode}
                      aria-label="검색 닫기"
                      className="-m-1 shrink-0 p-1 text-mute transition-colors hover:text-ink"
                    >
                      <ArrowLeft size={22} strokeWidth={2.2} />
                    </button>

                    {/* 검색 입력 컨테이너 (드롭다운 포함) */}
                    <div className="relative min-w-0 flex-1" ref={searchContainerRef}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="검색어 입력"
                          value={searchInput}
                          autoFocus
                          onChange={(e) => handleSearchInputChange(e.target.value)}
                          onFocus={() => setShowSuggestions(true)}
                          onKeyDown={handleSearchKeyDown}
                          className="min-w-0 flex-1 bg-transparent text-[22px] font-black tracking-[-0.8px] text-ink placeholder-faint-light outline-none"
                        />
                        <button
                          onClick={() => handleSearch(searchInput)}
                          disabled={searchLoading}
                          aria-label="검색"
                          className="shrink-0 p-1 text-esub transition-colors hover:text-ink disabled:opacity-50"
                        >
                          <Search size={19} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* 검색어 추천 드롭다운 */}
                      {showSuggestions && !isLoadingSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-8 top-full z-50 mt-2 overflow-hidden border border-ink bg-white py-1">
                          {suggestions.map((suggestion, index) => (
                            <button
                              key={suggestion}
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[14.5px] font-semibold transition-colors ${
                                index === selectedSuggestionIndex
                                  ? 'bg-ink text-white'
                                  : 'text-ebody hover:bg-canvas'
                              }`}
                            >
                              <Search size={13} className="shrink-0 opacity-50" />
                              <span>{suggestion}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  /* 일반 모드 */
                  <motion.div
                    key="normal-mode"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex items-baseline gap-3.5"
                  >
                    <b
                      className="text-[28px] font-black leading-none tracking-[-1px]"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {selDateObj ? `${selDateObj.getMonth() + 1}. ${selDateObj.getDate()}.` : `${month + 1}월`}
                    </b>
                    <span className="text-[13px] font-bold tracking-k2 text-mute">
                      {selDateObj ? WEEKDAYS_LONG[selDateObj.getDay()] : '전체 일정'}
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                      {/* 카테고리 필터 표시 */}
                      {selectedCategories.length > 0 && (
                        <span className="relative" ref={categoryTooltipRef}>
                          <button
                            onClick={() => setShowCategoryTooltip(!showCategoryTooltip)}
                            className="flex items-center gap-1.5 border border-hairline bg-white px-2.5 py-1.5 text-[12.5px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink"
                          >
                            <Tag size={11} />
                            필터 {selectedCategories.length}
                          </button>
                          <AnimatePresence>
                            {showCategoryTooltip && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full z-10 mt-1.5 min-w-[130px] border border-ink bg-white px-3.5 py-2.5"
                              >
                                {selectedCategories.map((id) => {
                                  const cat = categories.find((c) => c.id === id);
                                  if (!cat) return null;
                                  return (
                                    <div key={id} className="flex items-center gap-2 py-1">
                                      <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ backgroundColor: dotColor(cat) }}
                                      />
                                      <span className="text-[13.5px] font-bold text-ebody">{cat.name}</span>
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </span>
                      )}
                      <span className="text-[13px] font-bold text-primary">
                        {filteredSchedules.length + undatedSchedules.length}개
                      </span>
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className={`flex items-center gap-1.5 border px-3.5 py-2 text-[12px] font-extrabold tracking-k2 transition-colors ${
                          editMode
                            ? 'border-ink bg-ink text-white'
                            : 'border-hairline bg-white text-esub hover:border-ink hover:text-ink'
                        }`}
                      >
                        {editMode ? '완료' : '편집'}
                      </button>
                      <button
                        onClick={() => setIsSearchMode(true)}
                        className="flex items-center gap-1.5 border border-hairline bg-white px-3.5 py-2 text-[12px] font-extrabold tracking-k2 text-esub transition-colors hover:border-ink hover:text-ink"
                      >
                        <Search size={11} strokeWidth={2.5} />
                        검색
                      </button>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {loading ? (
              <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
            ) : filteredSchedules.length === 0 && undatedSchedules.length === 0 ? (
              // 검색 모드에서는 빈 메시지 표시 안 함
              !isSearchMode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="py-20 text-center text-mute"
                >
                  <Calendar size={36} className="mx-auto mb-4 text-faint" />
                  <p className="text-[14.5px]">등록된 일정이 없습니다</p>
                </motion.div>
              )
            ) : (
              <OverlayScrollbarsComponent
                element="div"
                id="adminScheduleScrollContainer"
                className="-mr-[10px] min-h-0 flex-1 pb-4 pr-[10px]"
                options={OS_LIST_OPTIONS}
                events={{
                  // 가상 스크롤·스크롤 위치 복원이 실제 스크롤 요소(OS 뷰포트)를 참조해야 한다
                  initialized: (inst) => { scrollContainerRef.current = inst.elements().viewport; },
                  scroll: (inst) => setScrollPosition(inst.elements().viewport.scrollTop),
                }}
              >
                {isSearchMode && searchTerm ? (
                  /* 검색 모드: 가상 스크롤 + ScheduleItem 재사용 */
                  <>
                    <div
                      style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {virtualizer.getVirtualItems().map((virtualItem) => {
                        const schedule = filteredSchedules[virtualItem.index];
                        if (!schedule) return null;

                        return (
                          <div
                            key={virtualItem.key}
                            ref={virtualizer.measureElement}
                            data-index={virtualItem.index}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualItem.start}px)`,
                            }}
                          >
                            <ScheduleItem
                              schedule={schedule}
                              getColorStyle={getColorStyle}
                              navigate={navigate}
                              openDeleteDialog={openDeleteDialog}
                              showYear
                              animated={false}
                              editMode={editMode}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* 무한 스크롤 트리거 & 로딩 인디케이터 */}
                    <div ref={loadMoreRef} className="py-4">
                      {isFetchingNextPage && (
                        <div className="flex justify-center">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                        </div>
                      )}
                      {!hasNextPage && filteredSchedules.length > 0 && (
                        <div className="text-center text-[13px] text-mute">
                          {filteredSchedules.length}개 표시 (모두 로드됨)
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* 일반 모드: ScheduleItem 컴포넌트 사용 */
                  <>
                    {filteredSchedules.map((schedule, index) => (
                      <ScheduleItem
                        key={`${schedule.id}-${selectedDate || 'all'}`}
                        schedule={schedule}
                        index={index}
                        selectedDate={selectedDate}
                        categories={categories}
                        getColorStyle={getColorStyle}
                        navigate={navigate}
                        openDeleteDialog={openDeleteDialog}
                        editMode={editMode}
                      />
                    ))}

                    {/* 날짜 미정 일정 — 하단에 구분선과 함께 */}
                    {undatedSchedules.length > 0 && (
                      <div className="flex items-center gap-3 pt-[26px]">
                        <b className="text-[12.5px] font-extrabold tracking-k25 text-mute">
                          날짜 미정 — {month + 1}월 중
                        </b>
                        <div className="flex-1 border-t border-dashed border-faint-light" />
                      </div>
                    )}
                    {undatedSchedules.map((schedule, index) => (
                      <ScheduleItem
                        key={`undated-${schedule.id}`}
                        schedule={schedule}
                        index={filteredSchedules.length + index}
                        selectedDate={selectedDate}
                        categories={categories}
                        getColorStyle={getColorStyle}
                        navigate={navigate}
                        openDeleteDialog={openDeleteDialog}
                        editMode={editMode}
                      />
                    ))}
                  </>
                )}
              </OverlayScrollbarsComponent>
            )}
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}

export default Schedules;
