import { useEffect, useState } from 'react';
import { KakaoMap } from '@/components/common';
import { WEEKDAYS } from '@/constants';

// @/utils에서 re-export (섹션들이 './utils'에서 함께 가져오도록)
export { decodeHtmlEntities, formatXDateTimeWithTime } from '@/utils';

/** 시안 형식 날짜: 2026. 7. 8. (수) 19:00 */
export function formatFactDate(date, time) {
  const d = new Date(`${date}T00:00:00`);
  const base = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
}

/**
 * URL·해시태그를 링크로 변환 (에디토리얼 그린)
 */
export function linkifyText(text) {
  if (!text) return null;

  const pattern = /(#[^\s#]+)|(https?:\/\/[^\s]+|(?:bit\.ly|youtu\.be|t\.co|goo\.gl|tinyurl\.com)\/[^\s]+)/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];

    if (matched.startsWith('#')) {
      const tag = matched.slice(1);
      parts.push(
        <a
          key={match.index}
          href={`https://x.com/hashtag/${encodeURIComponent(tag)}?src=hashtag_click`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary"
        >
          {matched}
        </a>
      );
    } else {
      const href = matched.startsWith('http') ? matched : `https://${matched}`;
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary"
        >
          {matched}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * 전체화면 시 자동 가로 회전 훅 (숏츠가 아닐 때만)
 */
export function useFullscreenOrientation(isShorts) {
  useEffect(() => {
    if (isShorts) return;

    const handleFullscreenChange = async () => {
      const isFullscreen = !!document.fullscreenElement;

      if (isFullscreen) {
        try {
          if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
          }
        } catch (e) {
          // 지원하지 않는 브라우저
        }
      } else {
        try {
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        } catch (e) {
          // 무시
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isShorts]);
}

export const XIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/** 팩트 행 (D_final_*_mobile 시안 공통) */
export function Fact({ k, children }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-baseline border-b border-hairline px-0.5 py-[13px]">
      <span className="text-[12px] font-extrabold tracking-k2 text-mute">{k}</span>
      <span className="text-[14.5px] font-semibold leading-[1.55] text-ink">{children}</span>
    </div>
  );
}

/**
 * 카드 이미지 (로드 실패 시 fallback 아이콘 — 인스타 등 CDN 만료 대비)
 */
export function CardImage({ src, className }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`${className} flex items-center justify-center bg-canvas text-faint`}>
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }
  return <img src={src} alt="" className={`${className} bg-canvas object-cover`} onError={() => setError(true)} />;
}

/** 인라인 카카오맵 + '카카오맵에서 보기' (PC 확정 개선) */
export function VenueMap({ venue, heightClass = 'h-[200px]' }) {
  if (!venue || !venue.lat || !venue.lng) return null;
  const kakaoMapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(venue.name)},${venue.lat},${venue.lng}`;

  return (
    <div className="relative mt-5 border border-hairline">
      <KakaoMap lat={Number(venue.lat)} lng={Number(venue.lng)} name={venue.name} className={`w-full ${heightClass}`} />
      <a
        href={kakaoMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-2.5 top-2.5 z-10 bg-ink px-3 py-[7px] text-[13px] font-extrabold tracking-k1 text-white"
      >
        카카오맵에서 보기 →
      </a>
    </div>
  );
}

export function roundDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
}
