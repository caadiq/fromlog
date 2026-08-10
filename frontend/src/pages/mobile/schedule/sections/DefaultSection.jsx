import { decodeHtmlEntities, Fact, formatFactDate } from './utils';

/**
 * Mobile 기본 섹션 — 에디토리얼 (리뉴얼 안 된 기타 카테고리용)
 */
function MobileDefaultSection({ schedule }) {
  return (
    <div className="px-[22px] pb-16 pt-[22px]">
      <h1
        className="text-[22px] font-extrabold leading-[1.4] tracking-[-0.5px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>
      <div className="mt-5 border-t-2 border-ink">
        <Fact k="DATE">{formatFactDate(schedule.date, schedule.time)}</Fact>
      </div>
      {schedule.description && (
        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-[1.7] text-ebody">
          {decodeHtmlEntities(schedule.description)}
        </p>
      )}
    </div>
  );
}

export default MobileDefaultSection;
