import { useMemo } from 'react';
import { WEEKDAYS } from '@/constants';

/**
 * PC 에디토리얼 달력 (design-drafts/S_final_main_pc 시안)
 * 월 네비게이션은 페이지 헤더에서 처리 — 이 컴포넌트는 날짜 그리드만 담당
 */
function EditorialCalendar({
  currentDate,
  selectedDate,
  onSelectDate,
  schedules = [],
  getCategoryColor,
  disabled = false,
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // 날짜별 일정 맵 (점 표시용)
  const scheduleDateMap = useMemo(() => {
    const map = new Map();
    schedules.forEach((s) => {
      const dateStr = s.date ? s.date.split('T')[0] : '';
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr).push(s);
    });
    return map;
  }, [schedules]);

  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  // 셀 목록: 이전 달 + 현재 달 + 다음 달 채움
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: prevMonthDays - firstDay + i + 1, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false });
  }
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 1; i <= 7 - remainder; i++) cells.push({ day: i, outside: true });
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-40 transition-opacity' : 'transition-opacity'}>
      {/* 요일 */}
      <div className="mb-1.5 grid grid-cols-7">
        {WEEKDAYS.map((d, i) => (
          <span
            key={d}
            className={`py-2 text-center text-[13px] font-extrabold tracking-[0.5px] ${
              i === 0 ? 'text-cal-sun' : i === 6 ? 'text-cal-sat' : 'text-mute'
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 border-l border-t border-hairline">
        {cells.map((cell, idx) => {
          const dow = idx % 7;
          if (cell.outside) {
            return (
              <div
                key={`o-${idx}`}
                className="relative aspect-[1.05] border-b border-r border-hairline p-[9px] text-[15.5px] font-medium text-faint"
              >
                {cell.day}
              </div>
            );
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === todayStr;
          const dots = (scheduleDateMap.get(dateStr) || []).slice(0, 3);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              aria-label={`${month + 1}월 ${cell.day}일${isToday ? ' (오늘)' : ''}${dots.length > 0 ? ', 일정 있음' : ''}`}
              aria-pressed={isSelected}
              className={`relative flex aspect-[1.05] items-start border-b border-r border-hairline p-[9px] text-left text-[15.5px] font-bold transition-colors ${
                isSelected
                  ? 'bg-ink text-white'
                  : `hover:bg-canvas ${dow === 0 ? 'text-cal-sun' : dow === 6 ? 'text-cal-sat' : 'text-ebody'}`
              } ${isToday ? 'shadow-[inset_0_0_0_2px_rgb(var(--c-primary))]' : ''}`}
            >
              {cell.day}
              {dots.length > 0 && (
                <span className="absolute bottom-[9px] left-[10px] flex gap-1">
                  {dots.map((s, i) => (
                    <i
                      key={i}
                      className="block h-[7px] w-[7px] rounded-full"
                      style={{
                        backgroundColor: getCategoryColor?.(s.category_id, s) || 'rgb(var(--c-primary-deep))',
                        // 선택 셀(검정 배경)에서 어두운 점도 보이도록 흰 링
                        boxShadow: isSelected ? '0 0 0 1.5px rgba(255,255,255,0.9)' : 'none',
                      }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default EditorialCalendar;
