import { NavLink, useLocation } from 'react-router-dom';

/**
 * 모바일 하단 네비게이션 — 에디토리얼 텍스트 탭 (C_final_mobile 시안)
 */
function MobileBottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'HOME' },
    { path: '/members', label: 'MEMBERS' },
    { path: '/album', label: 'ALBUMS' },
    { path: '/video', label: 'VIDEOS' },
    { path: '/schedule', label: 'SCHEDULE' },
  ];

  return (
    <nav
      className="z-50 flex-shrink-0 border-t border-hairline safe-area-bottom"
      style={{ background: 'rgba(251,251,249,0.92)', backdropFilter: 'blur(14px)' }}
    >
      <div className="flex items-center justify-around py-[15px]">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => window.scrollTo(0, 0)}
              className={`flex-1 text-center text-[11px] font-bold tracking-[0.5px] transition-colors ${
                isActive ? 'text-ink' : 'text-[#B9BCB3]'
              }`}
            >
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
