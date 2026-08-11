/**
 * AdminHeader — 에디토리얼 리뉴얼 (design-drafts/ADM_* 시안 공통 셸)
 * 워드마크 + ADMIN 배지 + 대문자 내비 + 계정/로그아웃
 */
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores';

// 자주 쓰는 관리 메뉴만 상단에 둔다. 테마·로그는 대시보드에서 들어간다.
const NAV = [
  { to: '/admin/dashboard', label: 'DASHBOARD' },
  { to: '/admin/members', label: 'MEMBERS' },
  { to: '/admin/albums', label: 'ALBUMS' },
  { to: '/admin/videos', label: 'VIDEOS' },
  { to: '/admin/schedule', label: 'SCHEDULE' },
];

function AdminHeader({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/admin', { replace: true });
  };

  return (
    <header className="flex h-[60px] items-center border-b border-hairline bg-paper px-10 text-ink">
      <Link to="/admin/dashboard" className="text-[19px] font-black tracking-[-0.5px]">
        fromlog
      </Link>
      <span className="ml-2.5 bg-ink px-2 py-1 text-[12px] font-extrabold tracking-k2 text-white">ADMIN</span>
      <nav className="ml-10 flex items-center gap-6">
        {NAV.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`text-[13px] font-extrabold tracking-k2 transition-colors ${
                active ? 'text-ink' : 'text-mute hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-[13.5px] text-esub">{user?.username} 님</span>
        <button
          type="button"
          onClick={handleLogout}
          className="border border-ink px-3.5 py-2 text-[12px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}

export default AdminHeader;
