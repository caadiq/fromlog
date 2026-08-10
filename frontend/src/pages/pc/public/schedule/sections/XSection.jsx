import { useState, useCallback } from 'react';
import { decodeHtmlEntities, formatXDateTimeWithTime } from './utils';
import { Lightbox } from '@/components/common';
import Crumb from './Crumb';

/**
 * URL·해시태그를 링크로 변환 (에디토리얼 그린)
 */
function linkifyText(text) {
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
          className="font-semibold text-primary hover:underline"
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
          className="font-semibold text-primary hover:underline"
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
 * 카드 이미지 (로드 실패 시 fallback 아이콘 — 인스타 등 CDN 만료 대비)
 */
function CardImage({ src, className }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`${className} flex items-center justify-center bg-canvas text-faint`}>
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }
  return <img src={src} alt="" className={`${className} bg-canvas object-cover`} onError={() => setError(true)} />;
}

const XIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/**
 * PC X 상세 — 에디토리얼 리뉴얼 (D_final_x_pc 시안)
 * 중앙 760px 포스트 카드: 프로필 → 본문 → 이미지 그리드 → 시각 → X에서 보기
 */
function XSection({ schedule }) {
  const profile = schedule.profile;
  const username = profile?.username || 'realfromis_9';
  const displayName = profile?.displayName || username;
  const avatarUrl = profile?.avatarUrl;

  // 라이트박스 상태 (히스토리 처리는 공용 Lightbox가 담당)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const imageUrls = schedule.imageUrls || [];

  return (
    <div className="mx-auto w-full max-w-[760px] px-10 pb-[90px]">
      <div className="pb-[22px] pt-11">
        <Crumb schedule={schedule} color="#141613" />
      </div>

      {/* 포스트 카드 */}
      <div className="border border-hairline bg-white">
        {/* 프로필 헤더 */}
        <div className="flex items-center gap-3 px-[22px] pt-5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-[46px] w-[46px] rounded-full object-cover" />
          ) : (
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-ink">
              <span className="text-lg font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <b className="flex items-center gap-1.5 text-[16px] font-extrabold text-ink">
              <span className="truncate">{displayName}</span>
              <svg className="h-[15px] w-[15px] shrink-0 text-[#1D9BF0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.07 4.57l-3.84-3.84 1.27-1.27 2.57 2.57 5.39-5.39 1.27 1.27-6.66 6.66z" />
              </svg>
            </b>
            <span className="block text-[13.5px] text-mute">@{username}</span>
          </div>
        </div>

        {/* 본문 */}
        <p className="whitespace-pre-wrap px-[22px] pb-1 pt-4 text-[16px] leading-[1.8] text-ink">
          {linkifyText(decodeHtmlEntities(schedule.content || schedule.title))}
        </p>

        {/* 이미지 그리드 */}
        {imageUrls.length > 0 && (
          <div className="px-[22px] pt-3.5">
            {imageUrls.length === 1 ? (
              /* 단일 이미지: 폭을 꽉 채우고 원본 비율 유지(세로 이미지도 잘리지 않음, 좌우 여백 없음) */
              <button type="button" onClick={() => openLightbox(0)} className="block w-full">
                <img
                  src={imageUrls[0]}
                  alt=""
                  className="block w-full transition-opacity hover:opacity-90"
                />
              </button>
            ) : (
              <div className="grid auto-rows-fr grid-cols-2 gap-[3px]">
                {imageUrls.slice(0, 4).map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openLightbox(i)}
                    className={imageUrls.length === 3 && i === 0 ? 'row-span-2' : ''}
                  >
                    <img
                      src={url}
                      alt=""
                      className={`h-full w-full object-cover transition-opacity hover:opacity-90 ${
                        imageUrls.length === 3 && i === 0 ? 'aspect-[0.62]' : 'aspect-square'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 영상 썸네일 (재생 → 원본 포스트) */}
        {schedule.videoThumbnails?.length > 0 && (
          <div className="space-y-[3px] px-[22px] pt-3.5">
            {schedule.videoThumbnails.map((url, i) => (
              <a
                key={i}
                href={schedule.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden"
              >
                <img src={url} alt="" className="w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 transition-colors group-hover:bg-black/70">
                    <svg className="ml-1 h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 px-2.5 py-1.5 text-[13.5px] font-bold text-white">
                  <XIcon className="h-3 w-3" />
                  X에서 재생
                </div>
              </a>
            ))}
          </div>
        )}

        {/* 링크 미리보기 카드 (Open Graph) — 자체 이미지/영상이 있으면 숨김 */}
        {schedule.card?.url && !(schedule.videoThumbnails?.length > 0) && !(imageUrls.length > 0) && (
          <div className="px-[22px] pt-3.5">
            <a
              href={schedule.card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-stretch overflow-hidden border border-hairline transition-colors hover:bg-canvas"
            >
              {schedule.card.image && (
                <CardImage src={schedule.card.image} className="h-32 w-32 shrink-0" />
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-center p-3.5">
                {schedule.card.destination && (
                  <p className="mb-0.5 text-[13.5px] text-mute">{schedule.card.destination}</p>
                )}
                {schedule.card.title && (
                  <p className="line-clamp-2 text-[16px] font-semibold text-ink">
                    {decodeHtmlEntities(schedule.card.title)}
                  </p>
                )}
                {schedule.card.description && (
                  <p className="mt-0.5 line-clamp-2 text-[15px] text-esub">
                    {decodeHtmlEntities(schedule.card.description)}
                  </p>
                )}
              </div>
            </a>
          </div>
        )}

        {/* 게시 시각 */}
        <div className="border-b border-hairline px-[22px] py-4 text-[14px] text-mute">
          {formatXDateTimeWithTime(schedule.date, schedule.time)}
        </div>

        {/* X에서 보기 */}
        <a
          href={schedule.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-[22px] my-[18px] flex items-center justify-center gap-2 bg-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
        >
          <XIcon className="h-3.5 w-3.5" />
          X에서 보기
        </a>
      </div>

      {/* 라이트박스 */}
      <Lightbox
        images={imageUrls}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

export default XSection;
