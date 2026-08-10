/**
 * 년/월 선택 팝오버 — 일정 관리 달력·DatePicker 공용
 * (일정 페이지 년월 픽커를 그대로 추출한 컴포넌트)
 *
 * @param {boolean} open - 팝오버 표시 여부
 * @param {number} year - 현재 선택된 년도
 * @param {number} month - 현재 선택된 월 (0-11)
 * @param {number} minYear - 선택 가능한 최소 년도
 * @param {function} onSelectYear - 년도 선택 콜백 (팝오버 유지)
 * @param {function} onSelectMonth - 월 선택 콜백 (호출측에서 닫기 처리)
 * @param {string} className - 위치 지정 클래스 (기본: 달력 헤더 아래)
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EASE } from '@/components/editorial';

// 년/월 픽커 셀 클래스
const pickerCell = (selected, isNow) =>
  `border py-2 text-center text-[14px] font-bold transition-colors ${
    selected
      ? 'border-ink bg-ink text-white'
      : isNow
        ? 'border-primary text-primary hover:bg-canvas'
        : 'border-hairline text-ebody hover:border-ink'
  }`;

function YearMonthPicker({
  open,
  year,
  month,
  minYear = 2017,
  onSelectYear,
  onSelectMonth,
  // 부모 폭 전체로 늘어나지 않도록 고정 폭 (inset-x-0이면 달력 컬럼만큼 늘어남)
  className = 'absolute left-0 top-11 z-20 w-[340px]',
}) {
  // 표시 중인 년도 범위 시작 (minYear 기준 12년 단위 그룹)
  const groupStart = (y) => minYear + Math.floor((y - minYear) / 12) * 12;
  const [rangeStart, setRangeStart] = useState(() => groupStart(year));

  // 열릴 때·년도 변경 시 현재 년도가 속한 범위로 리셋
  useEffect(() => {
    if (open) setRangeStart(groupStart(year));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, year]);

  const yearRange = Array.from({ length: 12 }, (_, i) => rangeStart + i);
  const canGoPrevYearRange = rangeStart > minYear;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const isCurrentYear = (y) => currentYear === y;
  const isCurrentMonth = (m) => currentYear === year && currentMonth === m;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.22, ease: EASE }}
          className={`${className} border border-ink bg-white px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(20,22,19,0.16)]`}
        >
          {/* 헤더 - 년도 범위 이동 */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => canGoPrevYearRange && setRangeStart(rangeStart - 12)}
              disabled={!canGoPrevYearRange}
              aria-label="이전 연도 범위"
              className={`-m-1 p-1 ${canGoPrevYearRange ? 'text-esub hover:text-ink' : 'text-faint'}`}
            >
              <ChevronLeft size={17} strokeWidth={2.5} />
            </button>
            <b className="text-[14px] font-black tracking-k1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {yearRange[0]} — {yearRange[yearRange.length - 1]}
            </b>
            <button
              type="button"
              onClick={() => setRangeStart(rangeStart + 12)}
              aria-label="다음 연도 범위"
              className="-m-1 p-1 text-esub hover:text-ink"
            >
              <ChevronRight size={17} strokeWidth={2.5} />
            </button>
          </div>

          {/* 년도 선택 */}
          <div className="mb-1.5 text-[12px] font-extrabold tracking-k25 text-mute">YEAR</div>
          <div className="grid grid-cols-4 gap-1.5">
            {yearRange.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => onSelectYear(y)}
                className={pickerCell(year === y, isCurrentYear(y))}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {y}
              </button>
            ))}
          </div>

          {/* 월 선택 */}
          <div className="mb-1.5 mt-3 text-[12px] font-extrabold tracking-k25 text-mute">MONTH</div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectMonth(i)}
                className={pickerCell(month === i, isCurrentMonth(i))}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default YearMonthPicker;
