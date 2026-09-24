import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, X, Plus, Inbox, CalendarDays, Link2, ScrollText, Palette, Video, Bot, Home as HomeIcon, LogOut, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useDialogBackClose } from '@/hooks/common';
import { getPendingCount } from '@/api/admin/pending';
import './admin.css';

const links = [
  ['일정 관리', '/admin/schedule', CalendarDays],
  ['일정 추가', '/admin/schedule/new', Plus],
  ['수집 큐', '/admin/schedule/queue', Inbox],
  ['고정 링크', '/admin/schedule/links', Link2],
  ['활동 로그', '/admin/logs', ScrollText],
  ['테마', '/admin/theme', Palette],
  ['영상 관리', '/admin/videos', Video],
  ['봇 관리', '/admin/schedule/bots', Bot],
];
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

export default function MobileAdminLayout({ children, headerContent, flush = false }) {
  const token = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef(null);
  const menuButton = useRef(null);
  const closingMenu = useRef(false);
  const enabled = Boolean(token && !auth.isLoading && !auth.isError);
  const pending = useQuery({ queryKey: ['admin', 'mobile', 'pending-count'], queryFn: getPendingCount, enabled });
  const count = pending.isSuccess ? pending.data.count : null;
  useEffect(() => {
    document.documentElement.classList.add('mobile-admin-layout');
    return () => document.documentElement.classList.remove('mobile-admin-layout');
  }, []);
  const finishClose = () => {
    closingMenu.current = false;
    drawer.current?.close();
    menuButton.current?.focus();
  };
  const closeMenu = () => {
    if (!drawer.current?.open || closingMenu.current) return;
    closingMenu.current = true;
    setMenuOpen(false);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishClose();
  };
  const openMenu = () => {
    if (!drawer.current || drawer.current.open) return;
    closingMenu.current = false;
    setMenuOpen(true);
    drawer.current.showModal();
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
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <header className="z-20 shrink-0 touch-none border-b border-hairline bg-paper pt-[env(safe-area-inset-top)]">
        <div className={`mx-auto flex h-16 max-w-[680px] items-center ${headerContent ? 'gap-0 px-2' : 'gap-2 px-4'}`}>
          <button ref={menuButton} onClick={openMenu} aria-label="관리 메뉴 열기" aria-haspopup="dialog" className={`flex h-11 w-11 shrink-0 items-center justify-center ${focus}`}><Menu size={24} /></button>
          {headerContent || <Link to="/admin/dashboard" className={`text-xl font-black tracking-tight ${focus}`}>fromlog <span className="ml-1 text-xs font-semibold text-mute">관리자</span></Link>}
        </div>
      </header>

      <main className={`mx-auto min-h-0 w-full max-w-[680px] flex-1 overscroll-none ${flush ? 'flex flex-col overflow-hidden' : 'overflow-y-auto px-5 pb-12 pt-7'}`}>
        {children}
      </main>

      <dialog ref={drawer} aria-labelledby="admin-menu-title" data-state={menuOpen ? 'open' : 'closing'} onCancel={event => { event.preventDefault(); closeMenu(); }} className="mobile-admin-menu">
        <div className="mobile-admin-menu-backdrop" aria-hidden="true" onClick={closeMenu} />
        <div className="mobile-admin-menu-panel bg-paper text-ink" onAnimationEnd={event => {
          if (event.target === event.currentTarget && event.animationName === 'admin-menu-exit' && closingMenu.current) finishClose();
        }}>
        <div className="flex min-h-full flex-col p-5 pt-[max(20px,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between"><h2 id="admin-menu-title" className="text-xl font-extrabold">관리 메뉴</h2><button onClick={closeMenu} aria-label="관리 메뉴 닫기" className={`flex h-11 w-11 items-center justify-center ${focus}`}><X size={23} /></button></div>
          <p className="mt-2 break-words text-sm text-mute">{auth.user?.username || '관리자'} 님</p>
          <nav aria-label="관리자" className="mt-6 space-y-1">
            <Link to="/admin/dashboard" onClick={closeMenu} aria-current={location.pathname === '/admin/dashboard' ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 px-3 text-sm font-bold ${location.pathname === '/admin/dashboard' ? 'bg-ink text-white' : 'hover:bg-white'} ${focus}`}><HomeIcon size={19} />홈</Link>
            {links.map(([label, to, Icon]) => <Link key={to} to={to} onClick={closeMenu} aria-current={location.pathname === to ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 px-3 text-sm font-semibold ${location.pathname === to ? 'bg-ink text-white' : 'hover:bg-white'} ${focus}`}><Icon size={19} />{label}{label === '수집 큐' && count > 0 && <span className="ml-auto bg-ink px-2 py-0.5 text-xs text-white">{count}</span>}</Link>)}
          </nav>
          <div className="mt-auto border-t border-hairline pt-5"><Link to="/" onClick={closeMenu} className={`flex min-h-12 items-center gap-3 px-3 text-sm ${focus}`}><ArrowUpRight size={19} />사이트로 이동</Link><button onClick={signOut} className={`flex min-h-12 w-full items-center gap-3 px-3 text-sm ${focus}`}><LogOut size={19} />로그아웃</button></div>
        </div>
        </div>
      </dialog>
    </div>
  );
}
