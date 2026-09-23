import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, X, Inbox, CalendarDays, ChevronRight, Plus, Link2, ScrollText, Palette, Video, Bot, Home as HomeIcon, LogOut, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useDocumentTitle, useDialogBackClose } from '@/hooks/common';
import { getPendingCount } from '@/api/admin/pending';
import { getStats } from '@/api/admin/stats';
import { getLogs } from '@/api/admin/logs';

const links = [
  ['일정 관리', '/admin/schedule', CalendarDays],
  ['일정 큐', '/admin/schedule/queue', Inbox],
  ['고정 링크', '/admin/schedule/links', Link2],
  ['활동 로그', '/admin/logs', ScrollText],
  ['테마', '/admin/theme', Palette],
  ['영상 관리', '/admin/videos', Video],
  ['봇 관리', '/admin/schedule/bots', Bot],
];
const quickLinks = [
  ['일정 추가', '/admin/schedule/new', Plus],
  links[2], links[3], links[4],
];
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

function dateLabel(value) {
  if (!value) return '';
  // API dates represent KST; display the stored wall time without shifting it.
  return String(value).replace('T', ' ').slice(0, 16);
}

export default function MobileAdminHome() {
  useDocumentTitle('관리자 홈');
  const token = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef(null);
  const menuButton = useRef(null);
  const closingMenu = useRef(false);
  const enabled = Boolean(token && !auth.isLoading && !auth.isError);
  const pending = useQuery({ queryKey: ['admin', 'mobile', 'pending-count'], queryFn: getPendingCount, enabled });
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: getStats, enabled });
  const logs = useQuery({ queryKey: ['admin', 'mobile', 'recent-logs'], queryFn: () => getLogs({ limit: 4 }), enabled });
  const queries = [pending, stats, logs];
  const count = pending.isSuccess ? pending.data.count : null;

  useEffect(() => () => { document.body.style.overflow = ''; }, []);
  const closeMenu = () => {
    const panel = drawer.current;
    if (!panel?.open || closingMenu.current) return;
    closingMenu.current = true;
    setMenuOpen(false);
    const finish = () => {
      closingMenu.current = false;
      if (!panel.isConnected) return;
      panel.close();
      document.body.style.overflow = '';
      menuButton.current?.focus();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    const from = getComputedStyle(panel).transform;
    panel.getAnimations().forEach(animation => animation.cancel());
    panel.animate([{ transform: from }, { transform: 'translateX(-100%)' }], {
      duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards',
    }).finished.then(finish, finish);
  };
  const openMenu = () => {
    const panel = drawer.current;
    if (!panel || panel.open) return;
    panel.getAnimations().forEach(animation => animation.cancel());
    setMenuOpen(true);
    panel.showModal();
    document.body.style.overflow = 'hidden';
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panel.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], {
        duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    }
  };
  useDialogBackClose(menuOpen, closeMenu);
  const signOut = () => {
    closeMenu();
    queryClient.removeQueries({ queryKey: ['admin'] });
    queryClient.removeQueries({ queryKey: ['pending-schedules'] });
    logout();
    navigate('/admin', { replace: true });
  };
  if (!token) return <Navigate to="/admin" replace />;
  if (auth.isLoading || auth.isError) return <div className="flex min-h-dvh items-center justify-center bg-paper text-sm text-mute" role="status">로그인 확인 중...</div>;

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-hairline bg-paper pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[680px] items-center gap-2 px-4">
          <button ref={menuButton} onClick={openMenu} aria-label="관리 메뉴 열기" aria-haspopup="dialog" className={`flex h-11 w-11 items-center justify-center ${focus}`}><Menu size={24} /></button>
          <Link to="/admin/dashboard" className={`text-xl font-black tracking-tight ${focus}`}>fromlog <span className="ml-1 text-xs font-semibold text-mute">관리자</span></Link>
        </div>
      </header>

      <main className="mx-auto max-w-[680px] px-5 pb-12 pt-7">
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
          <p className="mt-3 text-xs leading-relaxed text-mute">관리 메뉴는 현재 기존 화면으로 연결됩니다.</p>
        </section>

        <section className="mt-8" aria-labelledby="activity-title">
          <div className="flex items-center justify-between"><h2 id="activity-title" className="text-base font-extrabold">최근 활동</h2><Link to="/admin/logs" className={`flex min-h-11 items-center gap-1 text-sm text-mute ${focus}`}>전체보기<ChevronRight size={15} /></Link></div>
          <div className="border border-hairline bg-white" aria-busy={logs.isFetching}>
            {logs.isPending ? <p className="p-5 text-sm text-mute">최근 활동을 불러오는 중...</p> : logs.isError ? <p className="p-5 text-sm text-mute">최근 활동을 불러오지 못했습니다.</p> : !logs.data.logs?.length ? <p className="p-5 text-sm text-mute">아직 기록된 활동이 없습니다.</p> : logs.data.logs.map(log => <div key={log.id} className="flex gap-3 border-b border-hairline p-4 last:border-b-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${log.action === 'error' ? 'bg-[#C0392B]' : 'bg-primary'}`} /><div className="min-w-0"><p className="break-words text-sm font-semibold leading-relaxed">{log.summary}</p><p className="mt-1 text-xs text-mute">{log.action === 'error' ? '오류 · ' : ''}{dateLabel(log.created_at)}</p></div></div>)}
          </div>
        </section>
      </main>

      <dialog ref={drawer} aria-labelledby="admin-menu-title" onCancel={event => { event.preventDefault(); closeMenu(); }} onClick={e => { if (e.target === drawer.current) closeMenu(); }} className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(320px,88vw)] max-w-none bg-paper p-0 text-ink backdrop:bg-black/40">
        <div className="flex min-h-full flex-col p-5 pt-[max(20px,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between"><h2 id="admin-menu-title" className="text-xl font-extrabold">관리 메뉴</h2><button onClick={closeMenu} aria-label="관리 메뉴 닫기" className={`flex h-11 w-11 items-center justify-center ${focus}`}><X size={23} /></button></div>
          <p className="mt-2 break-words text-sm text-mute">{auth.user?.username || '관리자'} 님</p>
          <nav aria-label="관리자" className="mt-6 space-y-1">
            <Link to="/admin/dashboard" onClick={closeMenu} aria-current="page" className={`flex min-h-12 items-center gap-3 bg-ink px-3 text-sm font-bold text-white ${focus}`}><HomeIcon size={19} />홈</Link>
            <p className="px-3 pb-1 pt-5 text-xs text-mute">기존 관리 화면</p>
            {links.map(([label, to, Icon]) => <Link key={to} to={to} onClick={closeMenu} className={`flex min-h-12 items-center gap-3 px-3 text-sm font-semibold hover:bg-white ${focus}`}><Icon size={19} />{label}{label === '일정 큐' && count > 0 && <span className="ml-auto bg-ink px-2 py-0.5 text-xs text-white">{count}</span>}</Link>)}
          </nav>
          <div className="mt-auto border-t border-hairline pt-5"><Link to="/" onClick={closeMenu} className={`flex min-h-12 items-center gap-3 px-3 text-sm ${focus}`}><ArrowUpRight size={19} />사이트로 이동</Link><button onClick={signOut} className={`flex min-h-12 w-full items-center gap-3 px-3 text-sm ${focus}`}><LogOut size={19} />로그아웃</button></div>
        </div>
      </dialog>
    </div>
  );
}
