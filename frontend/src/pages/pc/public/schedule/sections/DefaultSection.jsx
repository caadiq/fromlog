import { decodeHtmlEntities } from './utils';
import Crumb from './Crumb';

/**
 * 기본 일정 섹션 — 에디토리얼 (에디토리얼 리뉴얼 안 된 기타 카테고리용)
 * 중앙 컬럼: 크럼(카테고리·날짜) + 제목 + 설명
 */
function DefaultSection({ schedule }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-[70px] pb-14 pt-[52px]">
      <Crumb schedule={schedule} />
      <h1
        className="mt-[24px] text-[34px] font-extrabold leading-[1.35] tracking-[-0.9px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>
      {schedule.description && (
        <p className="mt-8 whitespace-pre-wrap border-t-2 border-ink pt-6 text-[16px] leading-[1.7] text-ebody">
          {decodeHtmlEntities(schedule.description)}
        </p>
      )}
    </div>
  );
}

export default DefaultSection;
