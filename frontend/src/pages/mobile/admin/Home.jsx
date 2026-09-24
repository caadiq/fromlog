import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Inbox, CalendarDays, ChevronRight, Plus, Link2, ScrollText, Palette } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/common';
import { getPendingCount } from '@/api/admin/pending';
import { getStats } from '@/api/admin/stats';
import { getLogs } from '@/api/admin/logs';
import MobileAdminLayout from './Layout';

const quickLinks = [
  ['일정 추가', '/admin/schedule/new', Plus],
  ['고정 링크', '/admin/schedule/links', Link2],
  ['활동 로그', '/admin/logs', ScrollText],
  ['테마', '/admin/theme', Palette],
];
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

function dateLabel(value) {
  if (!value) return '';
  // API dates represent KST; display the stored wall time without shifting it.
  return String(value).replace('T', ' ').slice(0, 16);
}

export default function MobileAdminHome() {
  useDocumentTitle('관리자 홈');
  return <MobileAdminLayout><HomeContent /></MobileAdminLayout>;
}

function HomeContent() {
  const pending = useQuery({ queryKey: ['admin', 'mobile', 'pending-count'], queryFn: getPendingCount });
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: getStats });
  const logs = useQuery({ queryKey: ['admin', 'mobile', 'recent-logs'], queryFn: () => getLogs({ limit: 4 }) });
  const queries = [pending, stats, logs];
  const count = pending.isSuccess ? pending.data.count : null;

  return <>
        <h1 className="text-[26px] font-extrabold tracking-tight">오늘의 관리</h1>
        <p className="mt-1 text-sm text-mute">{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</p>

        {queries.some(q => q.isError) && <div role="alert" className="mt-5 border border-[#E5B8B3] bg-[#F9E9E7] p-4 text-sm text-[#A93226]">일부 정보를 불러오지 못했습니다. 잠시 후 다시 접속해주세요.</div>}

        <Link to="/admin/schedule/queue" className={`mt-6 flex min-h-28 items-center gap-4 border border-ink bg-white p-5 ${focus}`}>
          <Inbox size={28} className="shrink-0" />
          <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">검토할 일정</h2><p className="mt-1 text-[13px] leading-relaxed text-mute">{count === 0 ? '대기 중인 일정이 없습니다.' : '새 일정을 확인해주세요.'}</p></div>
          <strong className="shrink-0 text-xl text-primary">{count ?? '—'}<span className="ml-1 text-sm">건</span></strong><ChevronRight size={18} className="shrink-0" />
        </Link>
        <div className="mt-3 flex items-center justify-between border border-hairline bg-white px-5 py-4 text-sm"><span className="flex items-center gap-2 text-esub"><CalendarDays size={18} />전체 등록 일정</span><strong>{stats.isSuccess ? Number(stats.data.schedules || 0).toLocaleString('ko-KR') : '—'}건</strong></div>

        <section className="mt-8" aria-labelledby="quick-title">
          <h2 id="quick-title" className="text-base font-extrabold">빠른 작업</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {quickLinks.map(([label, to, Icon]) => <Link key={to} to={to} className={`flex min-h-20 items-center gap-3 border border-hairline bg-white px-4 py-4 text-sm font-bold ${focus}`}><Icon size={21} className="shrink-0" />{label}<ChevronRight size={15} className="ml-auto shrink-0 text-mute" /></Link>)}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-mute">일정과 활동 로그를 모바일에서 관리할 수 있습니다.</p>
        </section>

        <section className="mt-8" aria-labelledby="activity-title">
          <div className="flex items-center justify-between"><h2 id="activity-title" className="text-base font-extrabold">최근 활동</h2><Link to="/admin/logs" className={`flex min-h-11 items-center gap-1 text-sm text-mute ${focus}`}>전체보기<ChevronRight size={15} /></Link></div>
          <div className="border border-hairline bg-white" aria-busy={logs.isFetching}>
            {logs.isPending ? <p className="p-5 text-sm text-mute">최근 활동을 불러오는 중...</p> : logs.isError ? <p className="p-5 text-sm text-mute">최근 활동을 불러오지 못했습니다.</p> : !logs.data.logs?.length ? <p className="p-5 text-sm text-mute">아직 기록된 활동이 없습니다.</p> : logs.data.logs.map(log => <Link to={log.action === 'error' ? '/admin/logs?action=error' : '/admin/logs'} state={{ log }} key={log.id} className="flex gap-3 border-b border-hairline p-4 last:border-b-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${log.action === 'error' ? 'bg-[#C0392B]' : 'bg-primary'}`} /><div className="min-w-0"><p className="break-words text-sm font-semibold leading-relaxed">{log.summary}</p><p className="mt-1 text-xs text-mute">{log.action === 'error' ? '오류 · ' : ''}{dateLabel(log.created_at)}</p></div><ChevronRight size={16} className="ml-auto shrink-0 self-center text-mute" /></Link>)}
          </div>
        </section>
  </>;
}
