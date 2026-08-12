import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ArrowLeft,
  Grid3x3,
  Menu,
  Plus,
  CalendarPlus,
  Bot,
  Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';

import {
  getTodayKST,
  getCategoryInfo,
  getScheduleTime,
  decodeHtmlEntities,
  fireBirthdayConfetti,
  fireDebutConfetti,
  highlightTerm,
  isNoticeSchedule,
} from '@/utils';
import { getSchedules, searchSchedules } from '@/api';
import { useScheduleStore } from '@/stores';
import { MIN_YEAR, WEEKDAYS, WEEKDAYS_LONG } from '@/constants';
import {
  BirthdayCard as MobileBirthdayCard,
  DebutCard as MobileDebutCard,
} from '@/components/mobile';
import { DebutCelebrationDialog, BirthdayCelebrationDialog, ScheduleLinkStrip } from '@/components/common';
import { EASE } from '@/components/editorial';
import { useDocumentTitle, useDialogBackClose, useRecentSearches, useSuggestions, useInfiniteScheduleSearch } from '@/hooks/common';

const GREEN = 'rgb(var(--c-primary))';

/** 에디토리얼 일정 행 (S_final_main_mobile 시안) */
function EventRow({ schedule, onClick, dashed = false, subtitle: subtitleOverride }) {
  const time = getScheduleTime(schedule);
  const subtitle = subtitleOverride ?? schedule.source?.name ?? null;
  const { color, name } = getCategoryInfo(schedule);
  // 안내(📢) 일정은 시간·제목을 테마색으로 강조 (PC와 동일 규칙)
  const notice = isNoticeSchedule(schedule);

  return (
    <button
      type="button"
      onClick={() => onClick?.(schedule)}
      className={`flex w-full items-baseline gap-3.5 border-b px-0.5 py-4 text-left ${
        dashed ? 'border-dashed border-faint-light' : 'border-hairline'
      }`}
    >
      <span
        className={`w-[46px] shrink-0 text-[14.5px] font-extrabold ${
          notice ? 'text-notice' : time ? 'text-ink' : 'text-faint'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {time || '--:--'}
      </span>
      <span className="min-w-0 flex-1">
        <b
          className={`block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15.5px] font-bold tracking-[-0.2px] ${
            notice ? 'text-notice' : ''
          }`}
        >
          {decodeHtmlEntities(schedule.title)}
        </b>
        {subtitle && <span className="mt-0.5 block text-[13px] text-mute">{subtitle}</span>}
      </span>
      <span className="whitespace-nowrap text-[12px] font-extrabold tracking-[0.3px]" style={{ color }}>
        {name}
      </span>
    </button>
  );
}


/** 검색 결과 행 (S_final_search_mobile 시안) */
function SearchRow({ schedule, term, onClick }) {
  const d = new Date(`${schedule.date}T00:00:00`);
  const time = getScheduleTime(schedule);
  const title = decodeHtmlEntities(schedule.title);
  const { color, name } = getCategoryInfo(schedule);
  // 검색 결과에서는 제목 대신 날짜를 물들인다 (제목의 검색어 강조와 색이 겹치지 않게)
  const notice = isNoticeSchedule(schedule);

  return (
    <button
      type="button"
      onClick={() => onClick?.(schedule)}
      className="flex w-full items-center gap-[13px] border-b border-hairline px-0.5 py-[15px] text-left"
    >
      <span className="w-[74px] shrink-0">
        <span
          className="block text-[11.5px] font-bold text-mute"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {d.getFullYear()}
        </span>
        <b
          className={`block whitespace-nowrap text-[14.5px] font-extrabold tracking-[-0.3px] ${
            notice ? 'text-notice' : ''
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {d.getMonth() + 1}.{d.getDate()} {WEEKDAYS[d.getDay()]}
        </b>
        {time && <span className="mt-0.5 block text-[13px] font-bold text-mute">{time}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <b className="line-clamp-2 w-full min-w-0 text-[14.5px] font-bold leading-snug tracking-[-0.2px]">
          {highlightTerm(title, term)}
        </b>
        {schedule.source?.name && (
          <span className="mt-0.5 block text-[12.5px] text-mute">{schedule.source.name}</span>
        )}
      </span>
      <span className="whitespace-nowrap text-[12px] font-extrabold" style={{ color }}>
        {name}
      </span>
    </button>
  );
}

/** 인라인 월 달력 (S_final_picker_mobile 시안) */
function CalendarPanel({ viewDate, selectedDate, schedules, onSelectDate, onToday }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < startDow; i++) {
      out.push({ date: new Date(year, month, i - startDow + 1), out: true });
    }
    for (let d = 1; d <= lastDay; d++) {
      out.push({ date: new Date(year, month, d), out: false });
    }
    while (out.length % 7 !== 0) {
      const last = out[out.length - 1].date;
      out.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), out: true });
    }
    return out;
  }, [year, month]);

  const today = new Date();
  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  const dotsFor = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return schedules.filter((s) => s.date?.split('T')[0] === dateStr).slice(0, 3);
  };

  return (
    <div className="bg-white px-5 pb-5 pt-4">
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((d, i) => (
          <span
            key={d}
            className={`py-[7px] text-center text-[13px] font-extrabold tracking-[0.5px] ${
              i === 0 ? 'text-cal-sun' : i === 6 ? 'text-cal-sat' : 'text-mute'
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map(({ date, out }) => {
          const dow = date.getDay();
          const sel = !out && selectedDate && isSameDay(date, selectedDate);
          const isToday = !out && isSameDay(date, today);
          const dots = out ? [] : dotsFor(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={out}
              onClick={() => onSelectDate(date)}
              className={`relative flex aspect-square flex-col items-center justify-center gap-[3px] text-[14.5px] ${
                out
                  ? 'font-medium text-faint-light'
                  : sel
                    ? 'bg-ink font-bold text-white'
                    : dow === 0
                      ? 'font-bold text-cal-sun'
                      : dow === 6
                        ? 'font-bold text-cal-sat'
                        : 'font-bold text-ebody'
              }`}
              style={isToday && !sel ? { boxShadow: `inset 0 0 0 1.5px ${GREEN}` } : undefined}
            >
              {date.getDate()}
              <span className="flex h-[5px] gap-[3px]">
                {dots.map((s, i) => (
                  <i
                    key={i}
                    className="block h-[5px] w-[5px] rounded-full"
                    style={{
                      backgroundColor: getCategoryInfo(s).color,
                      boxShadow: sel ? '0 0 0 1.5px rgba(255,255,255,0.9)' : 'none',
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-center pb-0.5 pt-3.5">
        <button
          type="button"
          onClick={onToday}
          className="border px-[22px] py-2 text-[13px] font-extrabold tracking-k2"
          style={{ borderColor: GREEN, color: GREEN }}
        >
          오늘
        </button>
      </div>
    </div>
  );
}

/** 인라인 년월 픽커 (S_final_picker_ym_mobile 시안) */
function YearMonthPanel({ year, month, onSelectYear, onSelectMonth }) {
  const now = new Date();
  const [rangeStart, setRangeStart] = useState(MIN_YEAR + Math.floor((year - MIN_YEAR) / 4) * 4);
  const years = Array.from({ length: 4 }, (_, i) => rangeStart + i);

  const cell = (selected, isNow) =>
    `border py-[13px] text-center text-[15px] font-bold transition-colors ${
      selected
        ? 'border-ink bg-ink text-white'
        : isNow
          ? 'border-primary text-primary'
          : 'border-hairline text-ebody'
    }`;

  return (
    <div className="border-b border-hairline bg-white px-[22px] pb-[26px] pt-[22px]">
      <div className="mb-[14px] flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 연도 범위"
          onClick={() => setRangeStart((v) => Math.max(MIN_YEAR, v - 4))}
          disabled={rangeStart <= MIN_YEAR}
          className={`-m-1 p-1 ${rangeStart <= MIN_YEAR ? 'text-faint' : 'text-esub'}`}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <b className="text-[15px] font-black tracking-k1" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {years[0]} — {years[3]}
        </b>
        <button
          type="button"
          aria-label="다음 연도 범위"
          onClick={() => setRangeStart((v) => v + 4)}
          className="-m-1 p-1 text-esub"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
      <div className="mb-2.5 text-[12px] font-extrabold tracking-k25 text-mute">YEAR</div>
      <div className="grid grid-cols-4 gap-2">
        {years.map((y) => (
          <button key={y} type="button" onClick={() => onSelectYear(y)} className={cell(y === year, y === now.getFullYear())}>
            {y}
          </button>
        ))}
      </div>
      <div className="mb-2.5 mt-3.5 text-[12px] font-extrabold tracking-k25 text-mute">MONTH</div>
      <div className="grid grid-cols-4 gap-2">
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
    </div>
  );
}

/**
 * 모바일 일정 페이지 — 에디토리얼 리뉴얼 (design-drafts/S_final_main_mobile 시안)
 */
function MobileSchedule({ onCardClick, hideCelebration = false, onMenuClick, onAddClick, onBotClick } = {}) {
  // 관리자(onMenuClick 전달)면 '일정 관리', 공개면 '일정'
  useDocumentTitle(onMenuClick ? '일정 관리' : '일정');

  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);

  // zustand store에서 상태 가져오기
  const {
    selectedDate: storedSelectedDate,
    setSelectedDate: setStoredSelectedDate,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
  } = useScheduleStore();

  // 선택된 날짜 (store에 없으면 오늘 날짜). 매 렌더 새 Date 생성을 막아
  // 다수 useMemo/useEffect가 불필요하게 재실행되지 않도록 참조 안정화.
  const selectedDate = useMemo(
    () => storedSelectedDate || new Date(),
    [storedSelectedDate]
  );
  const setSelectedDate = (date) => setStoredSelectedDate(date);

  // 카드 클릭 핸들러 (안정적 참조로 카드 React.memo 유지)
  const handleCardClick = useCallback((schedule) => {
    if (onCardClick) {
      onCardClick(schedule);
      return;
    }
    // 앨범 발매 일정은 앨범 상세로
    if (schedule.albumFolder) {
      navigate(`/album/${schedule.albumFolder}`);
      return;
    }
    navigate(`/schedule/${schedule.id}`);
  }, [navigate, onCardClick]);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPanel, setShowPanel] = useState(false); // 인라인 달력 패널
  const [ymMode, setYmMode] = useState(false); // 패널 내 년월 픽커 모드
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date(selectedDate));
  const contentRef = useRef(null);
  const searchInputRef = useRef(null);

  // 검색 추천 관련 상태
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [originalSearchQuery, setOriginalSearchQuery] = useState('');
  const { suggestions } = useSuggestions(originalSearchQuery);

  // 최근 검색어 (localStorage 저장 — PC와 공유)
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useRecentSearches('schedule-recent-searches');
  const [showDebutDialog, setShowDebutDialog] = useState(false);
  const [debutDialogInfo, setDebutDialogInfo] = useState({ isDebut: false, anniversaryYear: 0 });
  const [showBirthdayDialog, setShowBirthdayDialog] = useState(false);
  const [birthdayInfo, setBirthdayInfo] = useState({ title: '', memberImage: '', date: '' });

  // 검색 상태 정리 (모드 종료 공통)
  const clearSearchState = useCallback(() => {
    setIsSearchMode(false);
    setSearchInput('');
    setOriginalSearchQuery('');
    setSearchTerm('');
    setShowSuggestions(false);
  }, []);

  // 검색 모드 — 브라우저 뒤로가기로 복귀 (useDialogBackClose가 히스토리 담당)
  useDialogBackClose(isSearchMode, clearSearchState);
  const enterSearchMode = () => {
    setIsSearchMode(true);
    setShowPanel(false);
    setYmMode(false);
  };

  // 검색 모드 종료 (← 버튼)
  const exitSearchMode = () => {
    clearSearchState();
  };

  // 달력 월 변경
  const changeCalendarMonth = (delta) => {
    const newDate = new Date(calendarViewDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCalendarViewDate(newDate);
  };

  // 검색 무한 스크롤 (평탄화·카테고리·하단 자동로드 포함)
  const {
    searchResults,
    searchCategories,
    loadMoreRef,
    hasNextPage,
    isFetchingNextPage,
    searchLoading,
  } = useInfiniteScheduleSearch({
    searchApi: searchSchedules,
    queryKey: 'mobileScheduleSearch',
    searchTerm,
    enabled: isSearchMode,
  });

  // 검색 결과 카테고리 필터 적용
  const filteredSearchResults = useMemo(() => {
    if (selectedCategories.length === 0) return searchResults;
    return searchResults.filter((s) => selectedCategories.includes(s.category_id));
  }, [searchResults, selectedCategories]);

  // 가상 스크롤 설정
  const virtualizer = useVirtualizer({
    count: isSearchMode && searchTerm ? filteredSearchResults.length : 0,
    getScrollElement: () => contentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  // 검색어 변경 시 스크롤 위치 초기화
  useEffect(() => {
    if (searchTerm) {
      requestAnimationFrame(() => {
        virtualizer.scrollToOffset(0);
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      });
    }
  }, [searchTerm]);


  // 일정 데이터 로드
  const viewYear = selectedDate.getFullYear();
  const viewMonth = selectedDate.getMonth() + 1;

  const { data: schedules = [], isLoading: loading } = useQuery({
    queryKey: ['schedules', viewYear, viewMonth],
    queryFn: () => getSchedules(viewYear, viewMonth),
  });

  // 달력 표시용 일정 데이터
  const calendarYear = calendarViewDate.getFullYear();
  const calendarMonth = calendarViewDate.getMonth() + 1;
  const isSameMonth = viewYear === calendarYear && viewMonth === calendarMonth;

  const { data: calendarSchedules = [] } = useQuery({
    queryKey: ['schedules', calendarYear, calendarMonth],
    queryFn: () => getSchedules(calendarYear, calendarMonth),
    enabled: !isSameMonth,
  });

  // 생일 폭죽 효과
  useEffect(() => {
    if (hideCelebration || loading || schedules.length === 0) return;

    const today = getTodayKST();
    const confettiKey = `birthday-confetti-${today}`;

    if (localStorage.getItem(confettiKey)) return;

    const birthdaySchedule = schedules.find((s) => {
      if (!s.is_birthday) return false;
      const scheduleDate = s.date ? s.date.split('T')[0] : '';
      return scheduleDate === today;
    });

    if (birthdaySchedule) {
      const timer = setTimeout(() => {
        fireBirthdayConfetti();
        setBirthdayInfo({
          title: birthdaySchedule.title || '',
          memberImage: birthdaySchedule.member_image || '',
          date: birthdaySchedule.date || '',
        });
        setShowBirthdayDialog(true);
        localStorage.setItem(confettiKey, 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [schedules, loading, hideCelebration]);

  // 데뷔/주년 폭죽 효과 및 다이얼로그
  useEffect(() => {
    if (hideCelebration || loading || schedules.length === 0) return;

    const today = getTodayKST();
    const confettiKey = `debut-confetti-${today}`;

    if (localStorage.getItem(confettiKey)) return;

    const debutSchedule = schedules.find((s) => {
      if (!s.is_debut && !s.is_anniversary) return false;
      const scheduleDate = s.date ? s.date.split('T')[0] : '';
      return scheduleDate === today;
    });

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
  }, [schedules, loading, hideCelebration]);

  // 2017년 1월 이전으로 이동 불가
  const canGoPrevMonth = !(selectedDate.getFullYear() === MIN_YEAR && selectedDate.getMonth() === 0);
  const canGoPrevCalMonth = !(calendarViewDate.getFullYear() === MIN_YEAR && calendarViewDate.getMonth() === 0);

  // 월 변경
  const changeMonth = (delta) => {
    if (delta < 0 && !canGoPrevMonth) return;

    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);

    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      newDate.setDate(today.getDate());
    } else {
      newDate.setDate(1);
    }

    setSelectedDate(newDate);
    setCalendarViewDate(newDate);
  };

  // 날짜 변경 시 스크롤 초기화
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [selectedDate]);


  // 해당 달의 모든 날짜 배열
  const daysInMonth = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [selectedDate]);

  // 선택된 날짜의 일정 (생일 우선) — 카테고리 필터 반영
  const selectedDateSchedules = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    // 백엔드에서 이미 정렬된 상태로 전달됨 (특수 일정 우선)
    return schedules.filter((s) => {
      if (s.datePrecision === 'month') return false; // 날짜 미정은 별도 처리
      if (s.date.split('T')[0] !== dateStr) return false;
      return selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
    });
  }, [schedules, selectedDate, selectedCategories]);

  // 날짜 미정(월만 확정) 일정 — 선택 날짜와 무관하게 해당 달이면 항상 하단에 표시
  const undatedSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (s.datePrecision !== 'month') return false;
      return selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
    });
  }, [schedules, selectedCategories]);

  // 해당 달 카테고리 목록 (카운트 포함)
  const monthCategories = useMemo(() => {
    const map = new Map();
    schedules.forEach((s) => {
      if (!s.category_id) return;
      const existing = map.get(s.category_id);
      if (existing) existing.count += 1;
      else map.set(s.category_id, { id: s.category_id, name: s.category_name, color: s.category_color, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.name === '기타') return 1;
      if (b.name === '기타') return -1;
      return b.count - a.count;
    });
  }, [schedules]);

  const totalCount = useMemo(
    () => monthCategories.reduce((sum, c) => sum + c.count, 0),
    [monthCategories]
  );

  // 날짜 점 표시용 (카테고리 필터 반영, 날짜는 전체 달 유지)
  // 날짜 미정 일정은 점을 찍지 않음 (특정 날짜에 속하지 않으므로)
  const dotSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (s.datePrecision === 'month') return false;
      return selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
    });
  }, [schedules, selectedCategories]);

  // 달력 패널 점 표시용 (보는 달이 다르면 별도 쿼리 데이터 사용)
  const panelDotSchedules = useMemo(() => {
    const source = isSameMonth ? schedules : calendarSchedules;
    return source.filter((s) => {
      if (s.datePrecision === 'month') return false;
      return selectedCategories.length === 0 || selectedCategories.includes(s.category_id);
    });
  }, [isSameMonth, schedules, calendarSchedules, selectedCategories]);

  // 오늘 여부
  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // 선택된 날짜 여부
  const isSelected = (date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // 날짜 선택 컨테이너 ref
  const dateScrollRef = useRef(null);

  // 선택된 날짜로 자동 스크롤
  useEffect(() => {
    if (!isSearchMode && !showPanel && dateScrollRef.current) {
      const selectedDay = selectedDate.getDate();
      const buttons = dateScrollRef.current.querySelectorAll('button');
      if (buttons[selectedDay - 1]) {
        setTimeout(() => {
          buttons[selectedDay - 1].scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        }, 50);
      }
    }
  }, [selectedDate, isSearchMode, showPanel]);

  // 검색 실행 핸들러
  const handleSearch = (term) => {
    if (term) {
      setSearchInput(term);
      setSearchTerm(term);
      addRecentSearch(term);
    }
    setShowSuggestions(false);
    searchInputRef.current?.blur();
  };

  // 패널 열기/닫기
  const togglePanel = () => {
    if (showPanel) {
      setShowPanel(false);
      setYmMode(false);
    } else {
      setCalendarViewDate(new Date(selectedDate));
      setShowPanel(true);
      setYmMode(false);
    }
  };

  // 타이틀 탭: 패널 닫힘 → 달력 열기 / 패널 열림 → 년월 픽커 토글
  const handleTitleTap = () => {
    if (!showPanel) {
      setCalendarViewDate(new Date(selectedDate));
      setShowPanel(true);
      setYmMode(false);
    } else {
      setYmMode((v) => !v);
    }
  };

  // 달력에서 날짜 선택 → 패널 닫기
  const handlePanelSelectDate = (date) => {
    setSelectedDate(date);
    setCalendarViewDate(date);
    setShowPanel(false);
    setYmMode(false);
  };

  const handlePanelToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCalendarViewDate(today);
    setShowPanel(false);
    setYmMode(false);
  };

  // 헤더 표기 년월 (패널 열림 시 보는 달 기준)
  const dispYear = showPanel ? calendarViewDate.getFullYear() : selectedDate.getFullYear();
  const dispMonth = showPanel ? calendarViewDate.getMonth() : selectedDate.getMonth();
  const headerCanGoPrev = showPanel ? canGoPrevCalMonth : canGoPrevMonth;

  const chipClass = (on) =>
    `flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 py-[7px] text-[12px] font-extrabold tracking-[0.5px] transition-colors ${
      on ? 'border-ink bg-ink text-white' : 'border-hairline text-esub'
    }`;

  return (
    <>
      {/* 툴바 */}
      <div className="shrink-0 bg-paper">
        {isSearchMode ? (
          /* ── 검색 툴바 (S_final_search_mobile 시안) ── */
          <motion.div
            key="search-toolbar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex items-center gap-3.5 border-b border-hairline px-5 py-4">
              <button
                type="button"
                onClick={exitSearchMode}
                aria-label="검색 닫기"
                className="-m-1 shrink-0 p-1 text-mute"
              >
                <ArrowLeft size={22} strokeWidth={2.2} />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2.5 border-b-2 border-ink pb-1.5">
                <input
                  ref={searchInputRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  placeholder="검색어 입력"
                  value={searchInput}
                  autoFocus={!searchTerm}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setOriginalSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(searchInput.trim());
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[17.5px] font-extrabold tracking-[-0.3px] text-ink placeholder-faint-light outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {searchInput && (
                  <button
                    type="button"
                    aria-label="지우기"
                    onClick={() => {
                      setSearchInput('');
                      setSearchTerm('');
                      setOriginalSearchQuery('');
                      setShowSuggestions(false);
                      searchInputRef.current?.focus();
                    }}
                    className="shrink-0 text-mute"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            {/* 추천 검색어 칩 */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="overflow-hidden border-b border-hairline"
                >
                  <div
                    className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-5 py-3.5"
                  >
                    <span className="mr-1 shrink-0 text-[12px] font-extrabold tracking-[1.5px] text-mute">
                      SUGGEST
                    </span>
                    {suggestions.map((sug, i) => (
                      <motion.button
                        key={sug}
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE, delay: i * 0.04 }}
                        onClick={() => handleSearch(sug)}
                        className="shrink-0 whitespace-nowrap border border-hairline px-3 py-1.5 text-[13px] font-bold text-esub"
                      >
                        {sug}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── 일정 툴바 (헤더 + 인라인 달력/스트립 + 필터) ── */
          <motion.div
            key="schedule-toolbar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div className="flex items-center gap-3">
                {onMenuClick && (
                  <button type="button" onClick={onMenuClick} className="-ml-1 p-1" aria-label="메뉴 열기">
                    <Menu size={20} className="text-ebody" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="이전 달"
                  onClick={() => (showPanel ? canGoPrevCalMonth && changeCalendarMonth(-1) : changeMonth(-1))}
                  disabled={!headerCanGoPrev}
                  className={`-m-1 p-1 ${headerCanGoPrev ? 'text-mute' : 'text-faint'}`}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={showPanel ? handleTitleTap : undefined}
                  disabled={!showPanel}
                  className={`flex items-center gap-1.5 text-[19px] font-black tracking-[-0.5px] ${
                    showPanel && ymMode ? 'text-primary' : 'text-ink'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {dispYear}. {dispMonth + 1}
                  {showPanel && (
                    <span
                      className={`text-[13px] text-primary transition-transform duration-200 ${
                        ymMode ? 'rotate-180' : ''
                      }`}
                    >
                      ▼
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="다음 달"
                  onClick={() => (showPanel ? changeCalendarMonth(1) : changeMonth(1))}
                  className="-m-1 p-1 text-mute"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  aria-label="달력"
                  onClick={togglePanel}
                  className={showPanel ? 'text-primary' : 'text-ebody'}
                >
                  <Grid3x3 size={18} strokeWidth={2.2} />
                </button>
                {!onMenuClick && (
                  <button type="button" aria-label="검색" onClick={enterSearchMode} className="text-ebody">
                    <Search size={18} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>

            {/* 인라인 달력 / 년월 픽커 패널 */}
            <AnimatePresence initial={false}>
              {showPanel && (
                <motion.div
                  key={ymMode ? 'ym-panel' : 'cal-panel'}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden border-b border-hairline"
                >
                  {ymMode ? (
                    <YearMonthPanel
                      year={calendarViewDate.getFullYear()}
                      month={calendarViewDate.getMonth()}
                      onSelectYear={(y) => setCalendarViewDate(new Date(y, calendarViewDate.getMonth(), 1))}
                      onSelectMonth={(m) => {
                        setCalendarViewDate(new Date(calendarViewDate.getFullYear(), m, 1));
                        setYmMode(false);
                      }}
                    />
                  ) : (
                    <CalendarPanel
                      viewDate={calendarViewDate}
                      selectedDate={selectedDate}
                      schedules={panelDotSchedules}
                      onSelectDate={handlePanelSelectDate}
                      onToday={handlePanelToday}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 가로 스크롤 날짜 스트립 + 카테고리 필터 */}
            {!showPanel && (
              <>
                <div
                  ref={dateScrollRef}
                  className="scrollbar-hide flex overflow-x-auto border-b border-hairline px-3 pb-3 pt-3.5"
                >
                  {daysInMonth.map((date) => {
                    const dow = date.getDay();
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const sel = isSelected(date);

                    const daySchedules = dotSchedules
                      .filter((s) => s.date?.split('T')[0] === dateStr)
                      .slice(0, 3);

                    return (
                      <button
                        key={date.getDate()}
                        type="button"
                        onClick={() => {
                          setSelectedDate(date);
                          setCalendarViewDate(date);
                        }}
                        className={`flex w-[52px] shrink-0 flex-col items-center pb-[9px] pt-2 ${
                          sel ? 'bg-ink' : ''
                        }`}
                      >
                        <span
                          className={`text-[13px] font-extrabold tracking-[0.5px] ${
                            sel
                              ? 'text-white'
                              : dow === 0
                                ? 'text-cal-sun'
                                : dow === 6
                                  ? 'text-cal-sat'
                                  : 'text-mute'
                          }`}
                        >
                          {WEEKDAYS[dow]}
                        </span>
                        <b
                          className={`mt-1 text-[17.5px] font-extrabold ${
                            sel
                              ? 'text-white'
                              : isToday(date)
                                ? 'text-primary'
                                : dow === 0
                                  ? 'text-cal-sun'
                                  : dow === 6
                                    ? 'text-cal-sat'
                                    : 'text-ink'
                          }`}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {date.getDate()}
                        </b>
                        <span className="mt-[5px] flex h-[5px] justify-center gap-[3px]">
                          {daySchedules.map((schedule, i) => (
                            <i
                              key={i}
                              className="block h-[5px] w-[5px] rounded-full"
                              style={{
                                backgroundColor: getCategoryInfo(schedule).color,
                                boxShadow: sel ? '0 0 0 1.5px rgba(255,255,255,0.9)' : 'none',
                              }}
                            />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {monthCategories.length > 0 && (
                  <div
                    className="scrollbar-hide flex gap-1.5 overflow-x-auto border-b border-hairline px-5 py-3"
                  >
                    <button type="button" onClick={() => setSelectedCategories([])} className={chipClass(selectedCategories.length === 0)}>
                      전체 {totalCount}
                    </button>
                    {monthCategories.map((cat) => {
                      const on = selectedCategories.includes(cat.id);
                      return (
                        <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)} className={chipClass(on)}>
                          <i
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: on ? '#fff' : cat.color }}
                          />
                          {cat.name} {cat.count}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 고정 링크 — 필터 칩과 같은 가로 스크롤. 없으면 안 그린다. */}
                <ScheduleLinkStrip mobile />
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* 컨텐츠 영역 */}
      <div className="mobile-content bg-paper" ref={contentRef}>
        {isSearchMode ? (
          /* ── 검색 결과 ── */
          <motion.div
            key={`${searchTerm || 'empty'}-${searchLoading ? 'loading' : 'ready'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {!searchTerm ? (
              /* ── 검색 전: 최근 검색어 (앱과 동일) ── */
              <>
                <div className="flex items-baseline justify-between px-[22px] pb-2.5 pt-[22px]">
                  <b className="text-[13px] font-extrabold tracking-k25">RECENT</b>
                  {recentSearches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearRecentSearches()}
                      className="text-[12.5px] font-bold text-mute"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
                <div className="mx-[22px] border-t-2 border-ink pb-16">
                  {recentSearches.length === 0 ? (
                    <div className="py-20 text-center text-[14.5px] text-mute">최근 검색어가 없습니다</div>
                  ) : (
                    recentSearches.map((term) => (
                      <div
                        key={term}
                        className="flex items-center gap-3.5 border-b border-hairline px-0.5 py-[15px]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSearchInput(term);
                            handleSearch(term);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                        >
                          <Clock size={16} className="shrink-0 text-mute" strokeWidth={2.2} />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                            {term}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`${term} 삭제`}
                          onClick={() => removeRecentSearch(term)}
                          className="-m-1 shrink-0 p-1 text-faint active:text-mute"
                        >
                          <X size={15} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
            <div className="flex items-baseline gap-2.5 px-[22px] pb-2.5 pt-[22px]">
              <b className="text-[13px] font-extrabold tracking-k25">RESULTS</b>
              <span className="text-[13px] font-bold text-primary">
                {`${filteredSearchResults.length}${hasNextPage ? '+' : ''}건`}
              </span>
              {searchCategories.length > 0 && (
                <span className="scrollbar-hide ml-auto flex gap-1.5 overflow-x-auto">
                  {searchCategories.map((c) => {
                    const on = selectedCategories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={`flex shrink-0 items-center gap-1 whitespace-nowrap border px-2 py-1 text-[12px] font-extrabold ${
                          on ? 'border-ink bg-ink text-white' : 'border-hairline text-esub'
                        }`}
                      >
                        <i className="h-1 w-1 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </button>
                    );
                  })}
                </span>
              )}
            </div>

            <div className="mx-[22px] border-t-2 border-ink pb-16">
              {searchLoading ? (
                <div className="py-20 text-center text-[14.5px] text-mute">검색 중...</div>
              ) : filteredSearchResults.length === 0 ? (
                <div className="py-20 text-center text-[14.5px] text-mute">
                  '{searchTerm}' 검색 결과가 없습니다
                </div>
              ) : (
                <>
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const schedule = filteredSearchResults[virtualItem.index];
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
                            <div className="py-2.5">
                              <MobileBirthdayCard schedule={schedule} showYear />
                            </div>
                          ) : schedule.is_debut || schedule.is_anniversary ? (
                            <div className="py-2.5">
                              <MobileDebutCard schedule={schedule} />
                            </div>
                          ) : (
                            <SearchRow
                              schedule={schedule}
                              term={searchTerm}
                              onClick={(s) =>
                                navigate(s.albumFolder ? `/album/${s.albumFolder}` : `/schedule/${s.id}`)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div ref={loadMoreRef} className="py-4">
                    {isFetchingNextPage && (
                      <div className="flex justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                      </div>
                    )}
                    {!hasNextPage && filteredSearchResults.length > 0 && (
                      <div className="text-center text-[13px] text-mute">
                        {filteredSearchResults.length}개 표시 (모두 로드됨)
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
              </>
            )}
          </motion.div>
        ) : (
          /* ── 선택 날짜 일정 리스트 ── */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          >
            <div className="flex items-baseline gap-3 px-[22px] pb-1 pt-6">
              <b className="text-[30px] font-black tracking-[-1px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {selectedDate.getMonth() + 1}. {selectedDate.getDate()}.
              </b>
              <span className="text-[13.5px] font-bold tracking-[0.5px] text-mute">
                {WEEKDAYS_LONG[selectedDate.getDay()]}
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-[14.5px] text-mute">로딩 중...</div>
            ) : (
              <motion.div
                key={selectedDate.toDateString()}
                className="px-[22px] pb-24"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                {selectedDateSchedules.map((schedule) => {
                  const isBirthday = schedule.is_birthday || String(schedule.id).startsWith('birthday-');
                  const isDebut = schedule.is_debut || schedule.is_anniversary;

                  if (isBirthday) {
                    return (
                      <div key={schedule.id} className="py-2.5">
                        <MobileBirthdayCard schedule={schedule} />
                      </div>
                    );
                  }

                  if (isDebut) {
                    return (
                      <div key={schedule.id} className="py-2.5">
                        <MobileDebutCard schedule={schedule} />
                      </div>
                    );
                  }

                  return <EventRow key={schedule.id} schedule={schedule} onClick={handleCardClick} />;
                })}

                {selectedDateSchedules.length === 0 && undatedSchedules.length === 0 && (
                  <div className="py-20 text-center text-[14.5px] text-mute">
                    {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정이 없습니다
                  </div>
                )}

                {/* 날짜 미정 일정 */}
                {undatedSchedules.length > 0 && (
                  <div className="mt-[26px]">
                    <div className="flex items-center gap-2.5">
                      <b className="text-[12px] font-extrabold tracking-k2 text-mute">
                        날짜 미정 — {selectedDate.getMonth() + 1}월 중
                      </b>
                      <div className="flex-1 border-t border-dashed border-faint-light" />
                    </div>
                    {undatedSchedules.map((schedule) => (
                      <EventRow
                        key={`undated-${schedule.id}`}
                        schedule={schedule}
                        onClick={handleCardClick}
                        dashed
                        subtitle={schedule.source?.name || `${selectedDate.getMonth() + 1}월 중 공개`}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* 데뷔/주년 축하 다이얼로그 */}
      <DebutCelebrationDialog
        isOpen={showDebutDialog}
        onClose={() => setShowDebutDialog(false)}
        isDebut={debutDialogInfo.isDebut}
        anniversaryYear={debutDialogInfo.anniversaryYear}
      />
      {/* 생일 축하 다이얼로그 */}
      <BirthdayCelebrationDialog
        isOpen={showBirthdayDialog}
        onClose={() => setShowBirthdayDialog(false)}
        title={birthdayInfo.title}
        memberImage={birthdayInfo.memberImage}
        date={birthdayInfo.date}
      />

      {/* 관리자 전용: 확장형 플로팅 버튼 (일정 추가 / 검색) */}
      {onMenuClick && !isSearchMode && (
        <>
          {/* 펼쳤을 때 바깥 탭으로 닫기 */}
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30"
                onClick={() => setFabOpen(false)}
              />
            )}
          </AnimatePresence>

          <div className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3">
            <AnimatePresence>
              {fabOpen && (
                <>
                  {onAddClick && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.9 }}
                      transition={{ duration: 0.14 }}
                      className="flex items-center gap-2.5"
                    >
                      <span className="bg-white px-3 py-1.5 rounded-lg shadow text-[15px] font-medium text-gray-700">일정 추가</span>
                      <button
                        type="button"
                        onClick={() => { setFabOpen(false); onAddClick(); }}
                        className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-primary active:scale-95 transition-transform"
                        aria-label="일정 추가"
                      >
                        <CalendarPlus size={22} />
                      </button>
                    </motion.div>
                  )}
                  {onBotClick && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.9 }}
                      transition={{ duration: 0.14, delay: 0.02 }}
                      className="flex items-center gap-2.5"
                    >
                      <span className="bg-white px-3 py-1.5 rounded-lg shadow text-[15px] font-medium text-gray-700">봇 관리</span>
                      <button
                        type="button"
                        onClick={() => { setFabOpen(false); onBotClick(); }}
                        className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-primary active:scale-95 transition-transform"
                        aria-label="봇 관리"
                      >
                        <Bot size={22} />
                      </button>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.9 }}
                    transition={{ duration: 0.14, delay: 0.03 }}
                    className="flex items-center gap-2.5"
                  >
                    <span className="bg-white px-3 py-1.5 rounded-lg shadow text-[15px] font-medium text-gray-700">검색</span>
                    <button
                      type="button"
                      onClick={() => { setFabOpen(false); enterSearchMode(); }}
                      className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-primary active:scale-95 transition-transform"
                      aria-label="검색"
                    >
                      <Search size={22} />
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* 메인 FAB */}
            <button
              type="button"
              onClick={() => setFabOpen((v) => !v)}
              className="w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
              aria-label="액션 메뉴"
            >
              <motion.span animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.18 }}>
                <Plus size={26} />
              </motion.span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default MobileSchedule;
