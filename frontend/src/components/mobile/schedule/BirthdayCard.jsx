import { memo } from 'react';
import { dayjs, decodeHtmlEntities } from '@/utils';

/**
 * 모바일 생일 카드 — 에디토리얼 (PC BirthdayCard 축소판)
 */
const BirthdayCard = memo(function BirthdayCard({ schedule, showYear = false }) {
  const d = dayjs(schedule.date);
  const dateStr = `${showYear ? `${d.year()}. ` : ''}${d.month() + 1}. ${d.date()}.`;

  // "HAPPY HAYOUNG DAY" → 가운데 이름만 핑크 강조
  const m = /^HAPPY (.+) DAY$/.exec(schedule.title || '');

  return (
    <div
      className="relative block w-full overflow-hidden border border-[#F2C7D4] px-[18px] py-4 text-left"
      style={{ background: 'linear-gradient(120deg,#FFF3F7,#FDEFF4 55%,#F4EDF9)' }}
    >
      <span className="pointer-events-none absolute -right-[22px] -top-[22px] h-[90px] w-[90px] rounded-full bg-[#E46E96]/10" />
      <span className="text-[12px] font-extrabold tracking-k3 text-[#D4548A]">HAPPY BIRTHDAY</span>
      <div className="mt-2.5 flex items-center gap-3.5">
        {schedule.member_image && (
          <img
            src={schedule.member_image}
            alt=""
            className="h-[48px] w-[48px] rounded-full border-2 border-white object-cover shadow-[0_4px_14px_rgba(212,84,138,0.22)]"
          />
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[17.5px] font-black leading-[1.15] tracking-[-0.4px] text-ink">
            {m ? (
              <>
                HAPPY <em className="not-italic text-[#D4548A]">{m[1]}</em> DAY
              </>
            ) : (
              decodeHtmlEntities(schedule.title)
            )}
          </h3>
          <div className="mt-[3px] text-[12.5px] font-semibold text-[#A98795]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {dateStr}
          </div>
        </div>
      </div>
      <span className="absolute bottom-3 right-4 text-[18px]">🎂</span>
    </div>
  );
});

export default BirthdayCard;
