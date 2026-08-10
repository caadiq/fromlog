import { NavLink } from 'react-router-dom';
import { ChevronLeft, Youtube, Instagram } from 'lucide-react';
import { SOCIAL_LINKS } from '@/constants';

const XIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/**
 * 모바일 헤더 — 에디토리얼 (C_final_mobile 시안)
 * 기본: 좌 fromlog 로고 + 우 ARCHIVE 라벨
 * @param {string} title - 페이지 제목 (있으면 가운데 타이틀 모드)
 * @param {boolean} showBack - 뒤로가기 버튼 표시 여부
 */
function MobileHeader({ title, showBack = false }) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper">
      <div className="relative flex h-[58px] items-center justify-between px-[22px]">
        {showBack ? (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="-ml-2 p-2 text-esub active:text-ink"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <NavLink to="/" className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">
            fromlog
          </NavLink>
        )}
        {title ? (
          <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-extrabold tracking-[-0.2px] text-ink">
            {title}
          </span>
        ) : null}
        <span className="flex items-center gap-4">
          <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="text-mute active:text-ink">
            <Youtube size={18} />
          </a>
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="text-mute active:text-ink">
            <Instagram size={17} />
          </a>
          <a href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer" className="text-mute active:text-ink">
            <XIcon size={15} />
          </a>
        </span>
      </div>
    </header>
  );
}

export default MobileHeader;
