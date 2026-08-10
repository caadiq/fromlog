import { memo } from 'react';
import { getCategoryInfo } from '@/utils';

/** hex → rgba (파생 톤 생성용) */
function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * PC 데뷔/주년 카드 — 에디토리얼 (D_final_special_cards 시안, 기념일 카테고리 색 기반)
 */
const DebutCard = memo(function DebutCard({ schedule }) {
  const isDebut = schedule.is_debut;
  const anniversaryYear = schedule.anniversary_year;
  const color = getCategoryInfo(schedule).color || '#8aa9d8';

  // "프로미스나인 데뷔 8주년" → "8주년"만 카테고리 색 강조
  const m = /^(.*?)(\d+주년)$/.exec(schedule.title || '');

  return (
    <div
      className="relative overflow-hidden border px-[22px] py-5"
      style={{
        borderColor: rgba(color, 0.35),
        background: `linear-gradient(120deg,${rgba(color, 0.07)},${rgba(color, 0.12)} 55%,${rgba(color, 0.16)})`,
      }}
    >
      <span
        className="pointer-events-none absolute -right-[26px] -top-[26px] h-[110px] w-[110px] rounded-full"
        style={{ backgroundColor: rgba(color, 0.12) }}
      />
      <span className="text-[12px] font-extrabold tracking-k3" style={{ color }}>
        {isDebut ? 'DEBUT DAY' : 'ANNIVERSARY'}
      </span>
      <div className="mt-3 flex items-center gap-4">
        <div
          className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color, boxShadow: `0 4px 14px ${rgba(color, 0.35)}` }}
        >
          {isDebut ? (
            <b className="text-[13px] font-black tracking-k1">DEBUT</b>
          ) : (
            <>
              <b className="text-[20px] font-black leading-none">{anniversaryYear}</b>
              <span className="text-[12px] font-extrabold tracking-[1.5px] opacity-85">YEARS</span>
            </>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[21px] font-black leading-[1.15] tracking-[-0.4px] text-ink">
            {m ? (
              <>
                {m[1]}
                <em className="not-italic" style={{ color }}>
                  {m[2]}
                </em>
              </>
            ) : (
              schedule.title
            )}
          </h3>
          <div className="mt-[3px] text-[13px] font-semibold text-esub" style={{ fontVariantNumeric: 'tabular-nums' }}>
            2018. 1. 24. — FROM US, PROMISE
          </div>
        </div>
      </div>
      <span className="absolute bottom-3.5 right-5 text-[18px] opacity-70" style={{ color }}>
        ✦
      </span>
    </div>
  );
});

export default DebutCard;
