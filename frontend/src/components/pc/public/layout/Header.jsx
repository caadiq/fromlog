import { NavLink } from 'react-router-dom';
import { Instagram, Youtube } from 'lucide-react';
import { SOCIAL_LINKS } from '@/constants';

/**
 * X (Twitter) 아이콘 컴포넌트
 */
const XIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/**
 * PC 헤더 — 에디토리얼 리뉴얼 내비
 * 레터스페이싱 영문 메뉴 + FAN ARCHIVE 라벨 + SNS (시안 공통 스펙)
 */
function Header() {
  const navItems = [
    { path: '/', label: 'HOME' },
    { path: '/members', label: 'MEMBERS' },
    { path: '/album', label: 'DISCOGRAPHY' },
    { path: '/video', label: 'VIDEOS' },
    { path: '/schedule', label: 'SCHEDULE' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper">
      <div className="flex items-center px-[70px] py-[22px]">
        {/* 로고 */}
        <NavLink to="/" className="text-[19px] font-extrabold tracking-[-0.3px] text-ink">
          fromlog
        </NavLink>

        {/* 네비게이션 */}
        <nav className="ml-[60px] flex items-center gap-[34px]">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `text-[13.5px] font-bold tracking-k2 transition-colors hover:text-ink ${
                  isActive ? 'text-ink' : 'text-mute'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 우측: SNS */}
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-4">
            <a
              href={SOCIAL_LINKS.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mute transition-colors hover:text-ink"
            >
              <Youtube size={18} />
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mute transition-colors hover:text-ink"
            >
              <Instagram size={18} />
            </a>
            <a
              href={SOCIAL_LINKS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mute transition-colors hover:text-ink"
            >
              <XIcon size={16} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
