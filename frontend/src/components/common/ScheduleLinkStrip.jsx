/**
 * 일정 페이지 고정 링크 스트립 (PC·모바일 공용)
 *
 * 투표·스밍 안내처럼 "지금 참여해야 하는 것"을 필터 줄 아래 한 줄로 노출한다.
 * 노출 중인 항목이 없으면 아무것도 그리지 않는다 — 평소 화면은 이 기능이 없을 때와 같다.
 *
 * PC   : 한 줄에 나란히
 * 모바일: 가로 스크롤 (필터 칩과 같은 방식)
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

/** '2026-08-16T23:59' → '8/16' (타임존 없는 벽시계 문자열이라 문자열로 자른다) */
function deadlineLabel(endsAt) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(endsAt || '');
  if (!m) return null;
  return `~${Number(m[1])}/${Number(m[2])}`;
}

function ScheduleLinkStrip({ mobile = false }) {
  const { data: links = [] } = useQuery({
    queryKey: ['schedule-links'],
    queryFn: getScheduleLinks,
    staleTime: 5 * 60 * 1000,
  });

  if (links.length === 0) return null;

  const items = links.map((l) => (
    <a
      key={l.id}
      href={l.url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        mobile
          ? 'inline-flex shrink-0 items-center gap-1.5 border border-hairline bg-white px-[11px] py-[7px] text-[12px] font-bold text-ebody transition-colors active:border-ink'
          : 'inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-ebody transition-colors hover:text-ink'
      }
    >
      <span aria-hidden>{KIND_EMOJI[l.kind] || KIND_EMOJI.etc}</span>
      <span className={mobile ? 'max-w-[190px] truncate' : ''}>{l.title}</span>
      {deadlineLabel(l.endsAt) ? (
        <span className="shrink-0 bg-[#FBF6E4] px-1.5 py-0.5 text-[10.5px] font-extrabold text-[#8A6D1B]">
          {deadlineLabel(l.endsAt)}
        </span>
      ) : (
        <ExternalLink size={11} className="shrink-0 text-faint-light" aria-label="새 탭에서 열림" />
      )}
    </a>
  ));

  if (mobile) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto border-b border-hairline px-5 py-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[10.5px] font-extrabold tracking-k12 text-mute">함께</span>
        {items}
      </div>
    );
  }

  return (
    <div className="mt-3.5 flex items-center gap-3.5 border border-hairline bg-white px-4 py-3">
      <span className="shrink-0 border-r border-hairline pr-3.5 text-[11.5px] font-extrabold tracking-k13 text-mute">
        함께 하기
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">{items}</div>
    </div>
  );
}

export default ScheduleLinkStrip;
