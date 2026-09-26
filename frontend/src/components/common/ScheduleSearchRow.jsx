import { ChevronRight } from 'lucide-react';
import { WEEKDAYS } from '@/constants';
import { decodeHtmlEntities, getScheduleTime, highlightTerm } from '@/utils';

export default function ScheduleSearchRow({ schedule, term, onClick, color, category, compact = false }) {
  const date = new Date(`${schedule.date}T00:00:00`);
  const validDate = !Number.isNaN(date.getTime());
  const time = getScheduleTime(schedule);
  return (
    <button type="button" onClick={() => onClick?.(schedule)}
      className={`flex w-full items-center border-b border-hairline text-left transition-colors hover:bg-canvas focus-visible:outline-primary ${compact ? 'gap-4 py-5' : 'gap-[26px] px-0.5 py-6'}`}>
      <span className={`shrink-0 border-r border-hairline text-left tabular-nums ${compact ? 'w-[78px] pr-3' : 'w-[134px] pr-[22px]'}`}>
        <span className={`block font-bold tracking-k15 text-mute ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          {validDate ? date.getFullYear() : '날짜'}
        </span>
        <span className={`mb-[7px] mt-1 block font-extrabold leading-[1.2] tracking-[-1px] ${compact ? 'text-[24px]' : 'text-[34px]'}`}>
          {validDate ? `${date.getMonth() + 1}.${date.getDate()}` : '미정'}
        </span>
        <span className={`block whitespace-nowrap text-mute ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          {validDate ? WEEKDAYS[date.getDay()] : ''}{time ? ` · ${time}` : ''}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`mb-2 flex min-w-0 items-center gap-2 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          <span className="shrink-0 font-bold" style={{ color }}>{category}</span>
          {schedule.source?.name && <>
            <span className="text-faint-light" aria-hidden>／</span>
            <span className="truncate text-mute">{schedule.source.name}</span>
          </>}
        </span>
        <span className={`line-clamp-2 font-bold leading-[1.55] tracking-[-0.4px] ${compact ? 'text-[15px]' : 'text-[19px]'}`}>
          {highlightTerm(decodeHtmlEntities(schedule.title), term)}
        </span>
      </span>
      {!compact && <ChevronRight size={16} className="shrink-0 text-faint" />}
    </button>
  );
}
