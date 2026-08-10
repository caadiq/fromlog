import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Lightbox, KakaoMap } from '@/components/common';
import { calcDday } from '@/utils';
import { decodeHtmlEntities } from './utils';
import Crumb, { formatCrumbDate } from './Crumb';

/**
 * PC 기타(공용) 상세 — 라디오·뮤지컬 등. 장소·포스터·설명 모두 선택.
 * 포스터가 있으면 2단(포스터 | 정보), 없으면 중앙 단 레이아웃.
 */
function EtcSection({ schedule }) {
  const posters = schedule.posters || [];
  const postUrls = schedule.postUrls || [];
  const venue = schedule.venue || null;
  const hasPoster = posters.length > 0;

  const kakaoMapUrl = venue && venue.lat && venue.lng
    ? `https://map.kakao.com/link/map/${encodeURIComponent(venue.name)},${venue.lat},${venue.lng}`
    : null;

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const lightboxImages = posters.map((p) => p.originalUrl || p.mediumUrl);
  const openLightbox = (index) => setLightbox({ open: true, index });

  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  // D-day (지난 일정은 '종료')
  const dday = calcDday(schedule.date);
  const ddayLabel = dday === null ? null : dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : '종료';
  const ddayTone = dday !== null && dday < 0
    ? 'bg-canvas-deep text-mute'
    : 'bg-green-soft text-green-deep';

  const facts = [];
  facts.push({
    k: 'DATE',
    v: (
      <>
        {formatCrumbDate(schedule.date, null)}
        {ddayLabel && (
          <span className={`ml-2.5 inline-block px-2.5 py-[3px] text-[12.5px] font-extrabold tracking-k1 ${ddayTone}`}>
            {ddayLabel}
          </span>
        )}
      </>
    ),
  });
  if (schedule.time) {
    facts.push({ k: 'TIME', v: schedule.time.slice(0, 5) });
  }
  if (venue) {
    facts.push({
      k: 'VENUE',
      v: (
        <>
          {venue.name}
          {venue.address && (
            <span className="mt-[3px] block text-[14.5px] font-medium text-mute">{venue.address}</span>
          )}
        </>
      ),
    });
  }
  if (postUrls.length > 0) {
    facts.push({
      k: 'LINKS',
      v: (
        <span className="flex flex-wrap gap-1.5">
          {postUrls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[14.5px] font-bold text-esub transition-colors hover:border-ink hover:text-ink"
            >
              {linkLabel(url)}
              <ExternalLink size={11} />
            </a>
          ))}
        </span>
      ),
    });
  }

  // 정보 컬럼 (포스터 유무 공통)
  const info = (
    <>
      <Crumb schedule={schedule} label="기타" />
      <h1
        className="mt-[26px] text-[34px] font-extrabold leading-[1.35] tracking-[-0.9px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>

      {schedule.description && (
        <p className="mt-7 whitespace-pre-wrap text-[16px] leading-[1.7] text-ebody">
          {decodeHtmlEntities(schedule.description)}
        </p>
      )}

      {/* 팩트 시트 (DATE·TIME은 항상, 장소·링크는 있을 때) */}
      {facts.length > 0 && (
        <div className="mt-8 border-t-2 border-ink">
          {facts.map((f) => (
            <div
              key={f.k}
              className="grid grid-cols-[120px_1fr] items-baseline border-b border-hairline px-0.5 py-[15px]"
            >
              <span className="text-[13px] font-extrabold tracking-k25 text-mute">{f.k}</span>
              <span className="text-[16.5px] font-semibold leading-[1.6] text-ink">{f.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* 카카오맵 */}
      {venue && venue.lat && venue.lng && (
        <div className="relative mt-[26px] border border-hairline">
          <KakaoMap
            lat={Number(venue.lat)}
            lng={Number(venue.lng)}
            name={venue.name}
            className="h-[230px] w-full"
          />
          <span className="pointer-events-none absolute bottom-3.5 left-4 z-10 text-[13.5px] font-extrabold tracking-k15 text-esub">
            KAKAO MAP
          </span>
          {kakaoMapUrl && (
            <a
              href={kakaoMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-3 z-10 bg-ink px-3.5 py-2 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody"
            >
              카카오맵에서 보기 →
            </a>
          )}
        </div>
      )}
    </>
  );

  // 포스터 없음 → 중앙 단 레이아웃
  if (!hasPoster) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-[70px] pb-14 pt-[52px]">
        {info}
      </div>
    );
  }

  // 포스터 있음 → 2단 레이아웃
  return (
    <div className="mx-auto grid w-full max-w-[1300px] flex-1 grid-cols-[1fr_1.05fr] px-[70px]">
      {/* 포스터 */}
      <div className="flex items-start justify-center border-r border-hairline px-16 pb-16 pt-[52px]">
        <div className="group relative w-full max-w-[430px] shadow-[0_30px_70px_rgba(20,22,19,0.22)]">
          <Swiper
            modules={[Navigation]}
            navigation={posters.length > 1 ? { prevEl: '.etc-prev', nextEl: '.etc-next' } : false}
            slidesPerView={1}
            loop={posters.length > 1}
            className="w-full"
          >
            {posters.map((p, idx) => (
              <SwiperSlide key={p.id}>
                <button type="button" onClick={() => openLightbox(idx)} className="block w-full cursor-zoom-in">
                  <img
                    src={p.mediumUrl || p.originalUrl}
                    alt={`${schedule.title} 포스터 ${idx + 1}`}
                    className="block h-auto w-full"
                  />
                </button>
              </SwiperSlide>
            ))}
          </Swiper>
          {posters.length > 1 && (
            <>
              <button
                className="etc-prev absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-white/90 text-ink opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                aria-label="이전 포스터"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="etc-next absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-white/90 text-ink opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                aria-label="다음 포스터"
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute bottom-3 right-3 z-10 bg-ink/70 px-2 py-0.5 text-[13.5px] font-bold text-white">
                {posters.length}장
              </div>
            </>
          )}
        </div>
      </div>

      {/* 정보 */}
      <div className="flex min-w-0 flex-col pb-14 pl-16 pt-[52px]">
        {info}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
        onIndexChange={(index) => setLightbox((prev) => ({ ...prev, index }))}
        showCounter={posters.length > 1}
        showDownload
      />
    </div>
  );
}

export default EtcSection;
