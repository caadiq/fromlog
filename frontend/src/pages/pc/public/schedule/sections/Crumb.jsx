import { WEEKDAYS } from '@/constants';

/** 시안 형식 날짜: 2026. 7. 8. (수) 19:00 */
export function formatCrumbDate(date, time) {
  const d = new Date(`${date}T00:00:00`);
  const base = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
}

/**
 * 에디토리얼 상세 크럼: 카테고리(컬러) / 날짜·시간
 * @param {string} label - 카테고리 표기 오버라이드 (예: "유튜브 · SHORTS")
 * @param {string} color - 카테고리 색 오버라이드
 */
function Crumb({ schedule, label, color }) {
  return (
    <div className="text-[14px] font-extrabold tracking-k25">
      <span style={{ color: color || schedule.category?.color || '#141613' }}>
        {label || schedule.category?.name?.toUpperCase() || ''}
      </span>
      <i className="not-italic mx-2 text-mute">/</i>
      <span className="text-mute">{formatCrumbDate(schedule.date, schedule.time)}</span>
    </div>
  );
}

export default Crumb;
