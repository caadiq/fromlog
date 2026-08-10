import { useState } from 'react';
import { MobileLightbox } from '@/components/common';
import { CardImage, decodeHtmlEntities, formatXDateTimeWithTime, linkifyText, XIcon } from './utils';

/**
 * X(트위터) 섹션 — 에디토리얼 (D_final_x_mobile 시안)
 */
function MobileXSection({ schedule }) {
  const profile = schedule.profile;
  const username = profile?.username || 'realfromis_9';
  const displayName = profile?.displayName || username;
  const avatarUrl = profile?.avatarUrl;
  const imageUrls = schedule.imageUrls || [];

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const openLightbox = (index) => {
    setLightbox({ open: true, index });
  };

  return (
    <div className="px-[22px] pb-16 pt-5">
      {/* 포스트 카드 */}
      <div className="border border-hairline bg-white">
        {/* 프로필 헤더 */}
        <div className="flex items-center gap-3 px-[18px] pt-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-[42px] w-[42px] rounded-full object-cover" />
          ) : (
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-ink">
              <span className="text-base font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <b className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
              <span className="truncate">{displayName}</span>
              <svg className="h-[14px] w-[14px] shrink-0 text-[#1D9BF0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.07 4.57l-3.84-3.84 1.27-1.27 2.57 2.57 5.39-5.39 1.27 1.27-6.66 6.66z" />
              </svg>
            </b>
            <span className="block text-[13px] text-mute">@{username}</span>
          </div>
        </div>

        {/* 본문 */}
        <p className="whitespace-pre-wrap px-[18px] pb-1 pt-3.5 text-[15px] leading-[1.75] text-ink">
          {linkifyText(decodeHtmlEntities(schedule.content || schedule.title))}
        </p>

        {/* 이미지 그리드 */}
        {imageUrls.length > 0 && (
          <div className="px-[18px] pt-3">
            {imageUrls.length === 1 ? (
              /* 단일 이미지: 폭을 꽉 채우고 원본 비율 유지(세로 이미지도 잘리지 않음, 좌우 여백 없음) */
              <button type="button" onClick={() => openLightbox(0)} className="block w-full">
                <img src={imageUrls[0]} alt="" className="block w-full" />
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
                      className={`h-full w-full object-cover ${
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
          <div className="space-y-[3px] px-[18px] pt-3">
            {schedule.videoThumbnails.map((url, i) => (
              <a
                key={i}
                href={schedule.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block overflow-hidden"
              >
                <img src={url} alt="" className="w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60">
                    <svg className="ml-0.5 h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-black/70 px-2 py-1 text-[13px] font-bold text-white">
                  <XIcon className="h-2.5 w-2.5" />
                  X에서 재생
                </div>
              </a>
            ))}
          </div>
        )}

        {/* 링크 미리보기 카드 (Open Graph) — 자체 이미지/영상이 있으면 숨김 */}
        {schedule.card?.url && !(schedule.videoThumbnails?.length > 0) && !(imageUrls.length > 0) && (
          <div className="px-[18px] pt-3">
            <a
              href={schedule.card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-stretch overflow-hidden border border-hairline"
            >
              {schedule.card.image && <CardImage src={schedule.card.image} className="h-24 w-24 shrink-0" />}
              <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
                {schedule.card.destination && (
                  <p className="mb-0.5 text-[13px] text-mute">{schedule.card.destination}</p>
                )}
                {schedule.card.title && (
                  <p className="line-clamp-2 text-[14.5px] font-semibold text-ink">
                    {decodeHtmlEntities(schedule.card.title)}
                  </p>
                )}
                {schedule.card.description && (
                  <p className="mt-0.5 line-clamp-2 text-[13.5px] text-esub">
                    {decodeHtmlEntities(schedule.card.description)}
                  </p>
                )}
              </div>
            </a>
          </div>
        )}

        {/* 게시 시각 */}
        <div className="border-b border-hairline px-[18px] py-3.5 text-[13.5px] text-mute">
          {formatXDateTimeWithTime(schedule.date, schedule.time)}
        </div>

        {/* X에서 보기 */}
        <a
          href={schedule.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-[18px] my-4 flex items-center justify-center gap-2 bg-ink py-[13px] text-[13.5px] font-extrabold tracking-k15 text-white"
        >
          <XIcon className="h-3.5 w-3.5" />
          X에서 보기
        </a>
      </div>

      {/* 라이트박스 */}
      <MobileLightbox
        images={imageUrls}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
        onIndexChange={(index) => setLightbox((prev) => ({ ...prev, index }))}
        showCounter={imageUrls.length > 1}
        showDownload
      />
    </div>
  );
}

export default MobileXSection;
