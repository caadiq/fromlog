import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MIN_YEAR, WEEKDAYS } from '@/constants';
import { getCategoryInfo } from '@/utils';

const GREEN = 'rgb(var(--c-primary))';

/** 인라인 월 달력 (S_final_picker_mobile 시안) */
export function CalendarPanel({ viewDate, selectedDate, schedules, onSelectDate, onToday }) {
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
export function YearMonthPanel({ year, month, onSelectYear, onSelectMonth }) {
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

