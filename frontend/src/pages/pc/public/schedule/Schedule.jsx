import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';

import { EditorialCalendar, BirthdayCard, DebutCard } from '@/components/pc/public';
import { DebutCelebrationDialog, BirthdayCelebrationDialog, Tooltip } from '@/components/common';
import { motion, AnimatePresence } from 'framer-motion';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { OutlineTitle, EASE } from '@/components/editorial';
import { fireBirthdayConfetti, fireDebutConfetti, highlightTerm } from '@/utils';
import { getSchedules, searchSchedules } from '@/api';
import { useScheduleStore } from '@/stores';
import { getTodayKST, getScheduleTime, decodeHtmlEntities, isNoticeSchedule } from '@/utils';
import { MIN_YEAR, DETAIL_NAV_CATEGORY_IDS, WEEKDAYS, WEEKDAYS_LONG } from '@/constants';
import { useDocumentTitle, useDialogBackClose, useRecentSearches, useSuggestions, useInfiniteScheduleSearch } from '@/hooks/common';

/** PC 헤더 높이 */
const HEADER_H = 74;
/** 측정 전 초기 상한 (헤더 아래 전체) */
const MAX_SPREAD_H = `calc(100dvh - ${HEADER_H}px)`;

/** 내부 목록 오버레이 스크롤바 — 페이지 스크롤바와 같은 테마 */
const OS_LIST_OPTIONS = {
  scrollbars: { theme: 'os-theme-fromis', autoHide: 'leave', autoHideDelay: 600, clickScroll: 'instant' },
};

/** 년월 선택 팝오버 (S_final_picker_pc 시안) */
function YearMonthPopover({ year, month, onSelectYear, onSelectMonth }) {
  const now = new Date();
  const [rangeStart, setRangeStart] = useState(MIN_YEAR + Math.floor((year - MIN_YEAR) / 4) * 4);
  const years = Array.from({ length: 4 }, (_, i) => rangeStart + i);

  const cell = (selected, isNow, disabled = false) =>
    `border py-[11px] text-center text-[14.5px] font-bold transition-colors ${
      disabled
        ? 'pointer-events-none border-hairline text-faint-light'
        : selected
          ? 'border-ink bg-ink text-white'
          : isNow
            ? 'border-primary text-primary hover:bg-canvas'
            : 'border-hairline text-ebody hover:border-ink'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, x: '-58%', y: -8, scale: 0.98 }}
      animate={{ opacity: 1, x: '-58%', y: 0, scale: 1 }}
      exit={{ opacity: 0, x: '-58%', y: -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="absolute left-1/2 top-[46px] z-20 w-[360px] border border-ink bg-white px-6 pb-[26px] pt-[22px] shadow-[0_24px_60px_rgba(20,22,19,0.16)]"
      style={{ transformOrigin: '58% top' }}
    >
      {/* 연도 범위 네비 */}
      <div className="mb-3.5 flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 연도 범위"
          onClick={() => setRangeStart((v) => Math.max(MIN_YEAR, v - 4))}
          disabled={rangeStart <= MIN_YEAR}
          className={`-m-1 p-1 transition-colors ${rangeStart <= MIN_YEAR ? 'text-faint' : 'text-esub hover:text-ink'}`}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <b className="text-[14.5px] font-black tracking-k1" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {years[0]} — {years[3]}
        </b>
        <button
          type="button"
          aria-label="다음 연도 범위"
          onClick={() => setRangeStart((v) => v + 4)}
          className="-m-1 p-1 text-esub transition-colors hover:text-ink"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
      {/* 연도 */}
      <div className="mb-2 mt-3 text-[12px] font-extrabold tracking-k25 text-mute">YEAR</div>
      <div className="grid grid-cols-4 gap-[7px]">
        {years.map((y) => (
          <button key={y} type="button" onClick={() => onSelectYear(y)} className={cell(y === year, y === now.getFullYear())}>
            {y}
          </button>
        ))}
      </div>
      {/* 월 */}
      <div className="mb-2 mt-3 text-[12px] font-extrabold tracking-k25 text-mute">MONTH</div>
      <div className="grid grid-cols-4 gap-[7px]">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectMonth(i)}
            className={cell(i === month, year === now.getFullYear() && i === now.getMonth())}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/** 에디토리얼 일정 행 (S_final_main_pc 시안) */
function EventRow({ schedule, onClick, dashed = false, subtitle: subtitleOverride, getCategoryColor, getCategoryName }) {
  const time = getScheduleTime(schedule);
  const sourceName = schedule.source?.name;
  const subtitle = subtitleOverride ?? sourceName ?? null;
  const color = getCategoryColor(schedule.category_id, schedule);
  const name = getCategoryName(schedule.category_id, schedule);
  // 안내(📢) 일정은 시간·제목을 테마색으로 물들여 훑을 때 바로 잡히게 한다.
  // 배경이 아니라 글자색이라 행 호버(회색 배경)와 겹치지 않는다.
  const notice = isNoticeSchedule(schedule);

  return (
    <Tooltip text={decodeHtmlEntities(schedule.title)} showOnlyOnOverflow className="block w-full">
      <button
        type="button"
        onClick={() => onClick?.(schedule)}
        className={`flex w-full items-baseline gap-[18px] border-b px-0.5 py-5 text-left transition-colors hover:bg-canvas ${
          dashed ? 'border-dashed border-faint-light' : 'border-hairline'
        }`}
      >
      <span
        className={`w-16 shrink-0 text-[16px] font-extrabold ${
          notice ? 'text-notice' : time ? 'text-ink' : 'text-faint'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {time || '--:--'}
      </span>
      <span className="min-w-0 flex-1">
        <b
          data-tooltip-overflow
          className={`block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[18px] font-bold tracking-[-0.2px] ${
            notice ? 'text-notice' : ''
          }`}
        >
          {decodeHtmlEntities(schedule.title)}
        </b>
        {subtitle && <span className="mt-1 block text-[14.5px] text-mute">{subtitle}</span>}
      </span>
      <span className="whitespace-nowrap text-[13.5px] font-extrabold tracking-[0.5px]" style={{ color }}>
        {name}
      </span>
      </button>
    </Tooltip>
  );
}


/** 검색 결과 행 (S_final_search_pc 시안) */
function SearchRow({ schedule, term, onClick, getCategoryColor, getCategoryName }) {
  const d = new Date(`${schedule.date}T00:00:00`);
  const time = getScheduleTime(schedule);
  const title = decodeHtmlEntities(schedule.title);
  // 검색 결과에서는 제목 대신 날짜를 물들인다.
  // 제목의 검색어 강조도 초록이라, 제목까지 칠하면 검색어가 묻혀버린다.
  const notice = isNoticeSchedule(schedule);

  return (
    <Tooltip text={title} showOnlyOnOverflow className="block w-full">
      <button
        type="button"
        onClick={() => onClick?.(schedule)}
        className="grid w-full grid-cols-[140px_1fr_140px_90px] items-center border-b border-hairline px-1 py-[19px] text-left transition-colors hover:bg-canvas"
      >
      <span
        className={`text-[17.5px] font-extrabold tracking-[-0.3px] ${notice ? 'text-notice' : ''}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {d.getFullYear()}. {d.getMonth() + 1}. {d.getDate()}. {WEEKDAYS[d.getDay()]}
        {time && <span className="mt-0.5 block text-[14.5px] font-bold tracking-k15 text-mute">{time}</span>}
      </span>
      <span
        data-tooltip-overflow
        className="line-clamp-2 min-w-0 pr-8 text-[18px] font-bold leading-snug tracking-[-0.2px]"
      >
        {highlightTerm(title, term)}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-mute">
        {schedule.source?.name || ''}
      </span>
      <span
        className="whitespace-nowrap text-right text-[14.5px] font-extrabold tracking-[0.5px]"
        style={{ color: getCategoryColor(schedule.category_id, schedule) }}
      >
        {getCategoryName(schedule.category_id, schedule)}
      </span>
      </button>
    </Tooltip>
  );
}

/**
 * PC 스케줄 페이지 — 에디토리얼 리뉴얼 (design-drafts/S_final_main_pc 시안)
 */
function PCSchedule() {
  useDocumentTitle('일정');

  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const searchContainerRef = useRef(null);

  // 상태 관리 (zustand store)
  const {
    currentDate,
    setCurrentDate,
    selectedDate: storedSelectedDate,
    setSelectedDate: setStoredSelectedDate,
    selectedCategories,
    setSelectedCategories,
    isSearchMode,
    setIsSearchMode,
    searchInput,
    setSearchInput,
    searchTerm,
    setSearchTerm,
  } = useScheduleStore();

  // 초기값 설정
  const selectedDate = storedSelectedDate === undefined ? getTodayKST() : storedSelectedDate;
  const setSelectedDate = setStoredSelectedDate;

  // 로컬 상태
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [originalSearchQuery, setOriginalSearchQuery] = useState('');
  const { suggestions } = useSuggestions(originalSearchQuery);
  const [showDebutDialog, setShowDebutDialog] = useState(false);
  const [debutDialogInfo, setDebutDialogInfo] = useState({ isDebut: false, anniversaryYear: 0 });
  const [showBirthdayDialog, setShowBirthdayDialog] = useState(false);
  const [birthdayInfo, setBirthdayInfo] = useState({ title: '', memberImage: '', date: '' });
  const [showYmPicker, setShowYmPicker] = useState(false);
  const ymPickerRef = useRef(null);

  // 최근 검색어 (모바일과 localStorage 공유)
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useRecentSearches('schedule-recent-searches');

  // 검색이 실행되면(searchTerm 변경) 최근 검색어에 기록
  useEffect(() => {
    if (searchTerm && searchTerm.trim()) addRecentSearch(searchTerm);
  }, [searchTerm, addRecentSearch]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 월별 일정 데이터
  const { data: schedules = [], isLoading: loading } = useQuery({
    queryKey: ['schedules', year, month + 1],
    queryFn: () => getSchedules(year, month + 1),
  });

  // 검색 무한 스크롤 (자동완성·평탄화·카테고리·하단 자동로드)
  const {
    searchResults,
    searchCategories,
    loadMoreRef,
    hasNextPage,
    isFetchingNextPage,
    searchLoading: isSearchLoading,
  } = useInfiniteScheduleSearch({
    searchApi: searchSchedules,
    queryKey: 'scheduleSearch',
    searchTerm,
    enabled: isSearchMode,
  });

  // 오늘 생일 폭죽
  useEffect(() => {
    if (loading || schedules.length === 0) return;
    const today = getTodayKST();
    const confettiKey = `birthday-confetti-${today}`;
    if (localStorage.getItem(confettiKey)) return;
    const hasBirthdayToday = schedules.some((s) => s.is_birthday && s.date === today);
    if (hasBirthdayToday) {
      const birthdaySchedule = schedules.find((s) => s.is_birthday && s.date === today);
      const timer = setTimeout(() => {
        fireBirthdayConfetti();
        setBirthdayInfo({
          title: birthdaySchedule.title || '',
          memberImage: birthdaySchedule.member_image || '',
          date: birthdaySchedule.date,
        });
        setShowBirthdayDialog(true);
        localStorage.setItem(confettiKey, 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [schedules, loading]);

  // 오늘 데뷔/주년 폭죽 및 다이얼로그
  useEffect(() => {
    if (loading || schedules.length === 0) return;
    const today = getTodayKST();
    const confettiKey = `debut-confetti-${today}`;
    if (localStorage.getItem(confettiKey)) return;
    const debutSchedule = schedules.find((s) => (s.is_debut || s.is_anniversary) && s.date === today);
    if (debutSchedule) {
      const timer = setTimeout(() => {
        fireDebutConfetti();
        setDebutDialogInfo({
          isDebut: debutSchedule.is_debut,
          anniversaryYear: debutSchedule.anniversary_year || 0,
        });
        setShowDebutDialog(true);
        localStorage.setItem(confettiKey, 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [schedules, loading]);

  // 외부 클릭 처리 (검색 추천 닫기)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
      if (ymPickerRef.current && !ymPickerRef.current.contains(event.target)) {
        setShowYmPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 날짜 변경 시 스크롤 초기화
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedDate]);

  // 카테고리 추출
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
    return Array.from(categoryMap.values());
  }, [schedules]);

  // 카테고리별 카운트 (선택 날짜와 무관하게 해당 달 전체 기준)
  const categoryCounts = useMemo(() => {
    const source = isSearchMode && searchTerm ? searchResults : schedules;
    const counts = new Map();
    let total = 0;

    source.forEach((s) => {
      const catId = s.category_id;
      if (catId) {
        counts.set(catId, (counts.get(catId) || 0) + 1);
        total++;
      }
    });
    counts.set('total', total);
    return counts;
  }, [schedules, searchResults, isSearchMode, searchTerm]);

  // 카테고리 색상/이름 가져오기
  const getCategoryColor = useCallback(
    (categoryId, schedule = null) => {
      if (schedule?.category_color) return schedule.category_color;
      const cat = categories.find((c) => c.id === categoryId);
      return cat?.color || '#808080';
    },
    [categories]
  );

  const getCategoryName = useCallback(
    (categoryId, schedule = null) => {
      if (schedule?.category_name) return schedule.category_name;
      const cat = categories.find((c) => c.id === categoryId);
      return cat?.name || '';
    },
    [categories]
  );

  // 필터링된 스케줄
  const currentYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

  // 달력·일정 열 높이 상한 — 제목 블록 아래 남은 공간 기준으로 잡는다.
  // 화면 전체(100dvh) 기준으로 잡으면 제목 높이만큼 항상 넘쳐서, 공간이 충분한데도
  // 페이지 스크롤 + 목록 내부 스크롤을 두 번 해야 했다.
  // 다만 남은 공간이 달력보다 작으면(짧은 화면) 달력 높이를 써서, 페이지를 조금 내려
  // 스프레드가 헤더에 고정되면 달력 전체가 보이도록 한다.
  const spreadRef = useRef(null);
  const calViewportRef = useRef(null);
  const calContentRef = useRef(null);
  const [spreadMaxH, setSpreadMaxH] = useState(null);

  const measureSpread = useCallback(() => {
    const grid = spreadRef.current;
    const parent = grid?.parentElement;
    if (!grid || !parent) return;
    let above = parseFloat(getComputedStyle(parent).paddingTop) || 0;
    for (const child of parent.children) {
      if (child === grid) break;
      above += child.getBoundingClientRect().height;
    }
    const available = window.innerHeight - HEADER_H - above;

    // 달력의 '내용' 높이를 잰다. 스크롤 컨테이너의 scrollHeight는 컨테이너가 늘어나면
    // 함께 커져서(내용보다 큰 clientHeight를 따라감) 한 번 커진 값이 그대로 남는다.
    const calVp = calViewportRef.current;
    const calContent = calContentRef.current;
    let calendarNatural = 0;
    if (calVp && calContent) {
      const host = calVp.closest('[data-overlayscrollbars]') || calVp.parentElement;
      const cs = host ? getComputedStyle(host) : null;
      const pad = cs ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) : 0;
      calendarNatural = calContent.getBoundingClientRect().height + pad;
    }
    // 남은 공간과 달력 높이 중 큰 값. 달력이 들어가면 남은 공간에 맞춰 페이지 스크롤이
    // 생기지 않고, 모자라면 모자란 만큼만 스크롤된다(= 화면을 줄일수록 조금씩 늘어남).
    // 화면을 넘지 않도록 헤더 아래 높이로 한 번 더 제한한다.
    const belowHeader = window.innerHeight - HEADER_H;
    const next = Math.round(Math.max(available, Math.min(calendarNatural, belowHeader)));
    setSpreadMaxH((prev) => (prev !== null && Math.abs(prev - next) < 2 ? prev : next));
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(measureSpread);
    window.addEventListener('resize', measureSpread);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measureSpread);
    };
  }, [measureSpread, currentYearMonth, loading, isSearchMode]);

  const filteredSchedules = useMemo(() => {
    // 백엔드에서 이미 정렬된 상태로 전달됨 (특수 일정 우선)
    if (isSearchMode) {
      if (!searchTerm) return [];
      if (selectedCategories.length === 0) return searchResults;
      return searchResults.filter((s) => selectedCategories.includes(s.category_id));
    }

    return schedules.filter((s) => {
      if (s.datePrecision === 'month') return false; // 날짜 미정은 별도 처리
      const matchesDate = selectedDate ? s.date === selectedDate : s.date?.startsWith(currentYearMonth);
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
      return matchesDate && matchesCategory;
    });
  }, [schedules, selectedDate, currentYearMonth, selectedCategories, isSearchMode, searchTerm, searchResults]);

  // 날짜 미정(월만 확정) 일정 — 선택 날짜와 무관하게 해당 월이면 항상 하단에 표시
  const undatedSchedules = useMemo(() => {
    if (isSearchMode) return [];
    return schedules.filter((s) => {
      if (s.datePrecision !== 'month') return false;
      const matchesMonth = s.date?.startsWith(currentYearMonth);
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
      return matchesMonth && matchesCategory;
    });
  }, [schedules, currentYearMonth, selectedCategories, isSearchMode]);

  // 달력 점 표시용 (카테고리만 필터링, 날짜는 한 달 전체 유지)
  // 날짜 미정 일정은 점을 찍지 않음 (특정 날짜에 속하지 않으므로)
  const calendarSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (s.datePrecision === 'month') return false;
      return selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
    });
  }, [schedules, selectedCategories]);

  // 가상 스크롤 (검색 결과)
  const virtualizer = useVirtualizer({
    count: isSearchMode && searchTerm ? filteredSchedules.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  // 일정 클릭 핸들러
  const handleScheduleClick = useCallback((schedule) => {
    // 앨범 발매 일정은 앨범 상세로
    if (schedule.albumFolder) {
      navigate(`/album/${schedule.albumFolder}`);
      return;
    }
    // 유튜브·X·콘서트만 상세 페이지로 이동
    if (DETAIL_NAV_CATEGORY_IDS.includes(schedule.category_id)) {
      navigate(`/schedule/${schedule.id}`);
      return;
    }
    // 소스 URL이 있으면 외부 링크로
    if (!schedule.description && schedule.source?.url) {
      window.open(schedule.source.url, '_blank');
    } else {
      navigate(`/schedule/${schedule.id}`);
    }
  }, [navigate]);

  // 카테고리 토글
  const toggleCategory = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter((id) => id !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  // 월 이동
  const canGoPrevMonth = !(year === MIN_YEAR && month === 0);

  const moveMonth = (delta) => {
    if (delta < 0 && !canGoPrevMonth) return;
    const newDate = new Date(year, month + delta, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedDate(getTodayKST());
    } else {
      setSelectedDate(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(getTodayKST());
  };

  // 팝오버에서 연도/월 선택
  const selectYmYear = (y) => {
    setCurrentDate(new Date(y, month, 1));
  };

  const selectYmMonth = (m) => {
    const newDate = new Date(year, m, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedDate(getTodayKST());
    } else {
      setSelectedDate(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`);
    }
    setShowYmPicker(false);
  };

  // 검색 상태 정리 (모드 종료 공통)
  const clearSearchState = useCallback(() => {
    setIsSearchMode(false);
    setSearchInput('');
    setOriginalSearchQuery('');
    setSearchTerm('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [setIsSearchMode, setSearchInput, setSearchTerm]);

  // 검색 모드 — 브라우저 뒤로가기로 복귀 (useDialogBackClose가 히스토리 담당)
  useDialogBackClose(isSearchMode, clearSearchState);
  const enterSearchMode = () => {
    setIsSearchMode(true);
  };

  // 검색 모드 종료 (← 버튼, Escape)
  const exitSearchMode = () => {
    clearSearchState();
  };

  // 일정 페이지를 벗어나면 검색 상태 초기화 (다른 페이지 갔다 돌아왔을 때 검색 화면이 남지 않도록)
  useEffect(() => {
    return () => {
      setIsSearchMode(false);
      setSearchInput('');
      setSearchTerm('');
    };
  }, [setIsSearchMode, setSearchInput, setSearchTerm]);


  // 검색 실행
  const executeSearch = () => {
    if (searchInput.trim()) {
      setSearchTerm(searchInput);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  // 선택 날짜 표기
  const selDateObj = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper text-ink">
      {isSearchMode ? (
        /* ── 검색 화면 (S_final_search_pc 시안) ──
           검색 결과는 가상 스크롤(useVirtualizer)이라 스크롤 컨테이너에 높이 경계가 필요하다.
           일정 화면은 페이지 전체가 스크롤되도록 바뀌었으므로 여기서만 화면 높이를 고정한다.
           (74px = PC 헤더 높이) */
        <div
          key="search-view"
          className="mx-auto flex min-h-0 w-full max-w-[980px] flex-col px-10 pt-[60px]"
          style={{ height: 'calc(100dvh - 74px)' }}
        >
          {/* 검색 입력 + 추천 (외부 클릭 감지 범위 공유) */}
          <motion.div
            ref={searchContainerRef}
            className="shrink-0"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
          <div className="flex items-center gap-5 border-b-[3px] border-ink pb-3.5">
            <button
              type="button"
              onClick={exitSearchMode}
              aria-label="검색 닫기"
              className="-m-1 shrink-0 p-1 text-mute transition-colors hover:text-ink"
            >
              <ArrowLeft size={30} strokeWidth={2.2} />
            </button>
            <input
              type="text"
              placeholder="검색어 입력"
              value={searchInput}
              autoFocus
              onChange={(e) => {
                setSearchInput(e.target.value);
                setOriginalSearchQuery(e.target.value);
                setShowSuggestions(true);
                setSelectedSuggestionIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  if (!suggestions.length) return;
                  e.preventDefault();
                  const newIndex = selectedSuggestionIndex < suggestions.length - 1 ? selectedSuggestionIndex + 1 : 0;
                  setSelectedSuggestionIndex(newIndex);
                  if (suggestions[newIndex]) setSearchInput(suggestions[newIndex]);
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  if (!suggestions.length) return;
                  e.preventDefault();
                  const newIndex = selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : suggestions.length - 1;
                  setSelectedSuggestionIndex(newIndex);
                  if (suggestions[newIndex]) setSearchInput(suggestions[newIndex]);
                } else if (e.key === 'Enter') {
                  if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                    setSearchInput(suggestions[selectedSuggestionIndex]);
                    setSearchTerm(suggestions[selectedSuggestionIndex]);
                  } else if (searchInput.trim()) {
                    setSearchTerm(searchInput);
                  }
                  setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                } else if (e.key === 'Escape') {
                  exitSearchMode();
                }
              }}
              className="h-[52px] min-w-0 flex-1 bg-transparent text-[40px] font-black tracking-[-1.5px] text-ink placeholder-faint-light focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setOriginalSearchQuery('');
                  setShowSuggestions(false);
                }}
                className="flex shrink-0 items-center gap-1.5 text-[16px] text-mute transition-colors hover:text-ink"
              >
                <X size={15} strokeWidth={2.5} />
                지우기
              </button>
            )}
          </div>

          {/* 추천 검색어 */}
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              className="mt-[18px] flex flex-wrap items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <span className="mr-1.5 text-[12px] font-extrabold tracking-k2 text-mute">SUGGEST</span>
              {suggestions.map((sug, i) => (
                <motion.button
                  key={sug}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE, delay: i * 0.05 }}
                  onClick={() => {
                    setSearchInput(sug);
                    setSearchTerm(sug);
                    setShowSuggestions(false);
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(i)}
                  className={`border px-[15px] py-2 text-[13.5px] font-bold transition-colors ${
                    i === selectedSuggestionIndex ? 'border-ink bg-ink text-white' : 'border-hairline text-esub hover:border-ink'
                  }`}
                >
                  {sug}
                </motion.button>
              ))}
            </motion.div>
          )}

          </motion.div>

          {/* RESULTS 헤더 + 카테고리 필터 */}
          <motion.div
            className="mb-1.5 mt-11 flex shrink-0 items-baseline gap-3.5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          >
            <b className="text-[14.5px] font-extrabold tracking-k3">{searchTerm ? 'RESULTS' : 'RECENT'}</b>
            {searchTerm ? (
              <span className="text-[13.5px] font-bold text-primary">
                {`${filteredSchedules.length}${hasNextPage ? '+' : ''}건`}
              </span>
            ) : (
              recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearRecentSearches()}
                  className="text-[13px] font-bold text-mute transition-colors hover:text-ink"
                >
                  전체 삭제
                </button>
              )
            )}
            {searchCategories.length > 0 && (
              <span className="ml-auto flex flex-wrap gap-1.5">
                {searchCategories.map((c) => {
                  const on = selectedCategories.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-extrabold tracking-k1 transition-colors ${
                        on ? 'border-ink bg-ink text-white' : 'border-hairline text-esub hover:border-ink'
                      }`}
                    >
                      <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </button>
                  );
                })}
              </span>
            )}
          </motion.div>

          {/* 결과 리스트 */}
          <div className="min-h-0 flex-1 border-t-2 border-ink">
          <OverlayScrollbarsComponent
            element="div"
            className="-mr-[10px] h-full pr-[10px]"
            options={OS_LIST_OPTIONS}
            events={{
              // 가상 스크롤(useVirtualizer)이 실제 스크롤 요소를 참조해야 한다
              initialized: (inst) => { scrollContainerRef.current = inst.elements().viewport; },
            }}
          >
          <motion.div
            key={`${searchTerm || 'empty'}-${isSearchLoading ? 'loading' : 'ready'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: searchTerm ? 0 : 0.16 }}
          >
            {searchTerm && filteredSchedules.length > 0 ? (
              <>
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
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
                        {schedule.is_birthday ? (
                          <div className="py-3">
                            <BirthdayCard schedule={schedule} showYear />
                          </div>
                        ) : schedule.is_debut || schedule.is_anniversary ? (
                          <div className="py-3">
                            <DebutCard schedule={schedule} />
                          </div>
                        ) : (
                          <SearchRow
                            schedule={schedule}
                            term={searchTerm}
                            onClick={handleScheduleClick}
                            getCategoryColor={getCategoryColor}
                            getCategoryName={getCategoryName}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div ref={loadMoreRef} className="py-4">
                  {isFetchingNextPage && (
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                    </div>
                  )}
                  {!hasNextPage && filteredSchedules.length > 0 && (
                    <div className="text-center text-[13.5px] text-mute">{filteredSchedules.length}개 표시 (모두 로드됨)</div>
                  )}
                </div>
              </>
            ) : searchTerm ? (
              <div className="py-24 text-center text-mute">
                {isSearchLoading ? '검색 중...' : `'${searchTerm}' 검색 결과가 없습니다`}
              </div>
            ) : recentSearches.length > 0 ? (
              <div>
                {recentSearches.map((term) => (
                  <div key={term} className="flex items-center gap-3.5 border-b border-hairline px-1 py-[15px]">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput(term);
                        setSearchTerm(term);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                    >
                      <Clock size={17} className="shrink-0 text-mute" strokeWidth={2.2} />
                      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{term}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${term} 삭제`}
                      onClick={() => removeRecentSearch(term)}
                      className="shrink-0 p-1 text-faint transition-colors hover:text-mute"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-[14.5px] text-mute">최근 검색어가 없습니다</div>
            )}
          </motion.div>
          </OverlayScrollbarsComponent>
          </div>
        </div>
      ) : (
      <div key="schedule-view" className="mx-auto flex min-h-0 w-full max-w-[1300px] flex-1 flex-col px-[70px]">
        {/* 페이지 헤더: 타이틀 + 월 네비 + 검색 */}
        <motion.div
          className="flex shrink-0 items-end justify-between border-b border-hairline pb-[34px] pt-16"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <OutlineTitle solid="SCHE" outline="DULE" className="text-[88px] tracking-[-4px]" />
          <div
            ref={ymPickerRef}
            className={`relative flex items-center gap-[22px] pb-2 ${isSearchMode ? 'pointer-events-none opacity-40' : ''}`}
          >
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => moveMonth(-1)}
              disabled={!canGoPrevMonth}
              className={`-m-1 p-1 transition-colors ${canGoPrevMonth ? 'text-esub hover:text-ink' : 'text-faint'}`}
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-expanded={showYmPicker}
              onClick={() => setShowYmPicker((v) => !v)}
              className={`flex items-baseline gap-1.5 text-[30px] font-black tracking-[-1px] transition-colors ${
                showYmPicker ? 'text-primary' : 'hover:text-primary'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {year}. {month + 1}
              <span className="text-[14.5px]">▾</span>
            </button>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
              className="-m-1 p-1 text-esub transition-colors hover:text-ink"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-1 text-[13px] font-extrabold tracking-k2 text-mute hover:text-ink"
            >
              TODAY
            </button>
            <AnimatePresence>
              {showYmPicker && (
                <YearMonthPopover year={year} month={month} onSelectYear={selectYmYear} onSelectMonth={selectYmMonth} />
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={enterSearchMode}
            className={`mb-2 flex items-center gap-1.5 border border-ink px-5 py-[11px] text-[13.5px] font-extrabold tracking-k15 transition-colors hover:bg-ink hover:text-white ${
              isSearchMode ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            <Search size={13} strokeWidth={2.5} />
            검색
          </button>
        </motion.div>

        {/* 카테고리 필터 */}
        <motion.div
          className="flex shrink-0 flex-wrap gap-2 border-b border-hairline py-[18px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          <button
            type="button"
            onClick={() => setSelectedCategories([])}
            className={`px-[17px] py-[9px] text-[14px] font-extrabold tracking-k1 transition-colors ${
              selectedCategories.length === 0
                ? 'border border-ink bg-ink text-white'
                : 'border border-hairline text-esub hover:border-ink'
            }`}
          >
            전체 {categoryCounts.get('total') || 0}
          </button>
          {categories.map((c) => {
            const on = selectedCategories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`flex items-center gap-[7px] px-[17px] py-[9px] text-[14px] font-extrabold tracking-k1 transition-colors ${
                  on ? 'border border-ink bg-ink text-white' : 'border border-hairline text-esub hover:border-ink'
                }`}
              >
                <i className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name} {categoryCounts.get(c.id) || 0}
              </button>
            );
          })}
        </motion.div>

        {/* 스프레드: 달력 | 일정 리스트
            높이를 고정하지 않고 각 열에 화면 높이 상한만 둔다 — 화면이 넉넉하면 내용만큼만
            차지해 스크롤이 아예 생기지 않고, 공간이 부족할 때만 상한에 걸려 내부 스크롤로
            넘어간다. 그때 상단 구분선이 헤더 아래에 닿으면 sticky로 고정된다.
            (74px = PC 헤더 높이) */}
        <motion.div
          ref={spreadRef}
          className="sticky grid grid-cols-[1.05fr_0.95fr]"
          style={{ top: HEADER_H }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.16 }}
        >
          <OverlayScrollbarsComponent
            element="div"
            className="border-r border-hairline py-9 pr-[50px]"
            options={OS_LIST_OPTIONS}
            events={{ initialized: (inst) => { calViewportRef.current = inst.elements().viewport; } }}
            style={{ maxHeight: spreadMaxH ? `${spreadMaxH}px` : MAX_SPREAD_H }}
          >
            <div ref={calContentRef}>
            <EditorialCalendar
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              schedules={calendarSchedules}
              getCategoryColor={getCategoryColor}
            />
            </div>
          </OverlayScrollbarsComponent>

          <div
            className="flex min-w-0 flex-col py-9 pl-14"
            style={{ maxHeight: spreadMaxH ? `${spreadMaxH}px` : MAX_SPREAD_H }}
          >
              <div className="flex min-h-0 flex-1 flex-col">
                {/* 날짜 헤더 */}
                <div className="flex shrink-0 items-baseline gap-4 border-b-2 border-ink pb-3.5">
                  <b className="text-[44px] font-black tracking-[-1.5px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selDateObj ? `${selDateObj.getMonth() + 1}. ${selDateObj.getDate()}.` : `${month + 1}월`}
                  </b>
                  <span className="text-[15.5px] font-bold tracking-[0.5px] text-mute">
                    {selDateObj ? WEEKDAYS_LONG[selDateObj.getDay()] : '전체 일정'}
                  </span>
                </div>

                {loading ? (
                  <div className="py-24 text-center text-mute">로딩 중...</div>
                ) : (
                  <OverlayScrollbarsComponent
                    element="div"
                    className="-mr-[10px] min-h-0 flex-1 pb-4 pr-[10px]"
                    options={OS_LIST_OPTIONS}
                    events={{ initialized: (inst) => { scrollContainerRef.current = inst.elements().viewport; } }}
                  >
                  <motion.div
                    key={selectedDate || currentYearMonth}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    {filteredSchedules.map((schedule) =>
                      schedule.is_birthday ? (
                        <div key={schedule.id} className="py-4">
                          <BirthdayCard schedule={schedule} />
                        </div>
                      ) : schedule.is_debut || schedule.is_anniversary ? (
                        <div key={schedule.id} className="py-4">
                          <DebutCard schedule={schedule} />
                        </div>
                      ) : (
                        <EventRow
                          key={schedule.id}
                          schedule={schedule}
                          onClick={handleScheduleClick}
                          getCategoryColor={getCategoryColor}
                          getCategoryName={getCategoryName}
                        />
                      )
                    )}

                    {filteredSchedules.length === 0 && undatedSchedules.length === 0 && (
                      <div className="py-24 text-center text-[14.5px] text-mute">
                        {selectedDate ? '이 날의 일정이 없습니다' : '이 달의 일정이 없습니다'}
                      </div>
                    )}

                    {/* 날짜 미정 일정 */}
                    {undatedSchedules.length > 0 && (
                      <div className="mt-[34px]">
                        <div className="flex items-center gap-3">
                          <b className="text-[13.5px] font-extrabold tracking-k25 text-mute">
                            날짜 미정 — {month + 1}월 중
                          </b>
                          <div className="flex-1 border-t border-dashed border-faint-light" />
                        </div>
                        {undatedSchedules.map((schedule) => (
                          <EventRow
                            key={`undated-${schedule.id}`}
                            schedule={schedule}
                            onClick={handleScheduleClick}
                            dashed
                            subtitle={schedule.source?.name || `${month + 1}월 중 공개`}
                            getCategoryColor={getCategoryColor}
                            getCategoryName={getCategoryName}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                  </OverlayScrollbarsComponent>
                )}
              </div>
          </div>
        </motion.div>
      </div>
      )}

      {/* 데뷔/주년 축하 다이얼로그 */}
      <DebutCelebrationDialog
        isOpen={showDebutDialog}
        onClose={() => setShowDebutDialog(false)}
        isDebut={debutDialogInfo.isDebut}
        anniversaryYear={debutDialogInfo.anniversaryYear}
      />
      <BirthdayCelebrationDialog
        isOpen={showBirthdayDialog}
        onClose={() => setShowBirthdayDialog(false)}
        title={birthdayInfo.title}
        memberImage={birthdayInfo.memberImage}
        date={birthdayInfo.date}
      />
    </div>
  );
}

export default PCSchedule;
