/**
 * DatePicker 컴포넌트
 * 연/월/일 선택이 가능한 드롭다운 형태의 날짜 선택기
 * 년/월 선택은 일정 페이지와 동일한 YearMonthPicker 팝오버 사용
 *
 * @param {string} value - 선택된 날짜 (YYYY-MM-DD 형식)
 * @param {function} onChange - 날짜 변경 콜백
 * @param {string} placeholder - 플레이스홀더 텍스트
 * @param {boolean} showDayOfWeek - 요일 표시 여부
 * @param {number} minYear - 선택 가능한 최소 연도 (기본값: 2000)
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAYS } from '@/constants';
import { useClickOutside } from '@/hooks/common';
import YearMonthPicker from './YearMonthPicker';

function DatePicker({
  value,
  onChange,
  placeholder = '날짜 선택',
  showDayOfWeek = false,
  minYear = 2000,
  min,
  max,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [showYmPicker, setShowYmPicker] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const ref = useRef(null);

  useClickOutside(ref, () => {
    setIsOpen(false);
    setShowYmPicker(false);
  });

  // value가 변경되면 viewDate도 업데이트
  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleButtonClick = (e, callback) => {
    e.preventDefault();
    e.stopPropagation();
    callback();
  };

  const canGoPrevMonth = !(year === minYear && month === 0);

  const prevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    if (newDate.getFullYear() >= minYear) {
      setViewDate(newDate);
    }
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const selectDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
    setShowYmPicker(false);
  };

  // 년도 선택 (팝오버 유지 — 일정 페이지와 동일 동작)
  const selectYear = (y) => {
    setViewDate(new Date(y, month, 1));
  };

  // 월 선택 시 적용 후 닫기
  const selectMonth = (m) => {
    setViewDate(new Date(year, m, 1));
    setShowYmPicker(false);
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (showDayOfWeek) {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const dayOfWeek = WEEKDAYS[date.getDay()];
      return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dayOfWeek})`;
    }
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  };

  const isSelected = (day) => {
    if (!value || !day) return false;
    const [y, m, d] = value.split('-');
    return parseInt(y) === year && parseInt(m) === month + 1 && parseInt(d) === day;
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const isDisabledDate = (day) => {
    if (!day) return true;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) =>
          handleButtonClick(e, () => {
            if (!isOpen && ref.current) {
              const rect = ref.current.getBoundingClientRect();
              const below = window.innerHeight - rect.bottom;
              // 달력 팝업 높이 대략 360px
              setDropUp(below < 360 && rect.top > below);
            }
            setShowYmPicker(false);
            setIsOpen((v) => !v);
          })
        }
        className={`flex w-full items-center justify-between border border-hairline bg-white font-bold transition-colors hover:border-ink focus:border-ink focus:outline-none ${
          compact ? 'px-3.5 py-2 text-[13px]' : 'px-3.5 py-2.5 text-[13.5px]'
        }`}
      >
        <span className={value ? 'text-ink' : 'text-faint'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar size={compact ? 14 : 15} className="text-mute" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropUp ? 10 : -10 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-80 border border-ink bg-white p-4 ${
              dropUp ? 'bottom-full mb-1.5' : 'mt-1.5'
            }`}
          >
            {/* 헤더: 이전/다음 달 + 년월 타이틀 (일정 페이지와 동일한 팝오버 토글) */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => handleButtonClick(e, prevMonth)}
                disabled={!canGoPrevMonth}
                aria-label="이전 달"
                className={`p-1.5 transition-colors ${
                  canGoPrevMonth ? 'hover:bg-canvas' : 'cursor-not-allowed opacity-30'
                }`}
              >
                <ChevronLeft size={18} className="text-esub" />
              </button>
              <button
                type="button"
                onClick={(e) => handleButtonClick(e, () => setShowYmPicker((v) => !v))}
                className={`flex items-baseline gap-1.5 text-[15px] font-black tracking-[-0.3px] transition-colors ${
                  showYmPicker ? 'text-primary' : 'hover:text-primary'
                }`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {year}. {month + 1}
                <span className="text-[12px] text-primary">▾</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleButtonClick(e, nextMonth)}
                aria-label="다음 달"
                className="p-1.5 transition-colors hover:bg-canvas"
              >
                <ChevronRight size={18} className="text-esub" />
              </button>
            </div>

            {/* 년/월 선택 팝오버 (일정 페이지와 공용 컴포넌트) */}
            <YearMonthPicker
              open={showYmPicker}
              year={year}
              month={month}
              minYear={minYear}
              onSelectYear={selectYear}
              onSelectMonth={selectMonth}
              className="absolute inset-x-0 top-12 z-20"
            />

            {/* 요일 헤더 + 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={`py-1 text-center text-[12px] font-extrabold tracking-k1 ${
                    i === 0 ? 'text-[#C25450]' : i === 6 ? 'text-[#3D6291]' : 'text-mute'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const dayOfWeek = i % 7;
                const disabled = isDisabledDate(day);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!day || disabled}
                    onClick={(e) => day && !disabled && handleButtonClick(e, () => selectDate(day))}
                    className={`flex aspect-square items-center justify-center text-[13.5px] font-semibold transition-all
                      ${!day ? '' : disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-canvas'}
                      ${isSelected(day) ? 'bg-ink text-white hover:bg-ink' : ''}
                      ${isToday(day) && !isSelected(day) && !disabled ? 'font-extrabold text-primary ring-1 ring-inset ring-primary' : ''}
                      ${day && !isSelected(day) && !isToday(day) && !disabled && dayOfWeek === 0 ? 'text-[#C25450]' : ''}
                      ${day && !isSelected(day) && !isToday(day) && !disabled && dayOfWeek === 6 ? 'text-[#3D6291]' : ''}
                      ${day && !isSelected(day) && !isToday(day) && !disabled && dayOfWeek > 0 && dayOfWeek < 6 ? 'text-ebody' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DatePicker;
