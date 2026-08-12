/**
 * 일정 페이지 고정 링크 (투표·스밍 안내 등)
 *
 * PC   : 필터 줄 아래 한 줄 스트립 (ScheduleLinkStrip)
 * 모바일: 헤더 확성기 버튼으로 펼치는 패널 (ScheduleLinkPanel)
 *         — 상시 노출하면 목록 높이가 그만큼 줄고, 툴바가 커진 만큼 스크롤이 생긴다.
 *
 * 노출 중인 항목이 없으면 아무것도 그리지 않는다.
 */
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { getScheduleLinks } from '@/api';

/** 유형별 아이콘 — 관리자 ScheduleLinkDialog 의 KIND_META 와 같은 값 */
const KIND_EMOJI = {
  vote: '🗳',
  stream: '🎧',
  notice: '📌',
  etc: '🔗',
};

/** 마감이 임박했다고 볼 기간 — 헤더 아이콘에 점을 띄우는 기준 */
const URGENT_DAYS = 7;

/** '2026-08-16T23:59' → '8/16' (타임존 없는 벽시계 문자열이라 문자열로 자른다) */
function deadlineLabel(endsAt) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(endsAt || '');
  return m ? `~${Number(m[1])}/${Number(m[2])}` : null;
}

/** 마감까지 URGENT_DAYS 이내인가 (종료일 없으면 false) */
function isUrgent(endsAt) {
  if (!endsAt) return false;
  const end = new Date(endsAt).getTime(); // 벽시계 문자열 → 로컬 시각으로 해석
  if (Number.isNaN(end)) return false;
  const left = end - Date.now();
  return left >= 0 && left <= URGENT_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * 고정 링크 조회 훅.
 * @returns {{links: Array, hasUrgent: boolean}} hasUrgent — 마감 임박 항목이 있으면 true
 */
export function useScheduleLinks() {
  const { data: links = [] } = useQuery({
    queryKey: ['schedule-links'],
    queryFn: getScheduleLinks,
    staleTime: 5 * 60 * 1000,
  });
  return { links, hasUrgent: links.some((l) => isUrgent(l.endsAt)) };
}

/** 마감 배지 또는 새 탭 아이콘 */
function Trailing({ endsAt }) {
  const label = deadlineLabel(endsAt);
  if (!label) {
    return <ExternalLink size={12} className="shrink-0 text-faint-light" aria-label="새 탭에서 열림" />;
  }
  return (
    <span className="shrink-0 bg-[#FBF6E4] px-1.5 py-0.5 text-[10.5px] font-extrabold text-[#8A6D1B]">
      {label}
    </span>
  );
}

/** PC — 필터 줄 아래 한 줄 */
function ScheduleLinkStrip() {
  const { links } = useScheduleLinks();
  if (links.length === 0) return null;

  return (
    <div className="mt-3.5 flex items-center gap-3.5 border border-hairline bg-white px-4 py-3">
      <span className="shrink-0 border-r border-hairline pr-3.5 text-[11.5px] font-extrabold tracking-k2 text-mute">
        NOW
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
        {links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-ebody transition-colors hover:text-ink"
          >
            <span aria-hidden>{KIND_EMOJI[l.kind] || KIND_EMOJI.etc}</span>
            {l.title}
            <Trailing endsAt={l.endsAt} />
          </a>
        ))}
      </div>
    </div>
  );
}

/** 모바일 — 헤더 버튼으로 펼치는 세로 목록 (달력 패널과 같은 자리) */
export function ScheduleLinkPanel() {
  const { links } = useScheduleLinks();
  if (links.length === 0) return null;

  return (
    <div className="bg-white pb-2.5 pt-1.5">
      <div className="flex items-baseline gap-2 px-5 pb-1.5 pt-2">
        <b className="text-[10.5px] font-extrabold tracking-k2 text-mute">NOW</b>
        <span className="text-[11px] text-faint">새 탭으로 열립니다</span>
      </div>
      {links.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 border-t border-hairline px-5 py-[11px] active:bg-canvas"
        >
          <span className="shrink-0 text-[14px]" aria-hidden>
            {KIND_EMOJI[l.kind] || KIND_EMOJI.etc}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">{l.title}</span>
          <Trailing endsAt={l.endsAt} />
        </a>
      ))}
    </div>
  );
}

export default ScheduleLinkStrip;
