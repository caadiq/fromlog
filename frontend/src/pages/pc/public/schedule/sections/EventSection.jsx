import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Lightbox, KakaoMap } from '@/components/common';
import { decodeHtmlEntities } from './utils';
import Crumb from './Crumb';

/**
 * PC 행사(대학 축제 등) 상세 — 에디토리얼 리뉴얼 (D_final_event_pc 시안)
 * 좌 포스터 | 우 크럼·제목·팩트시트(장소/링크)·카카오맵
 */
function EventSection({ schedule }) {
  const posters = schedule.posters || [];
  const postUrls = schedule.postUrls || [];
  const venue = schedule.venue || null;
  const isUniversity = schedule.subtype === 'university';
  const typeLabel = isUniversity ? '행사 · 대학축제' : '행사';

  const kakaoMapUrl = venue && venue.lat && venue.lng
    ? `https://map.kakao.com/link/map/${encodeURIComponent(venue.name)},${venue.lat},${venue.lng}`
    : null;

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const lightboxImages = posters.map((p) => p.originalUrl || p.mediumUrl);
  const openLightbox = (index) => setLightbox({ open: true, index });

  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  const facts = [];
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

  return (
    <div className="mx-auto grid w-full max-w-[1300px] flex-1 grid-cols-[1fr_1.05fr] px-[70px]">
      {/* 포스터 */}
      <div className="flex items-start justify-center border-r border-hairline px-16 pb-16 pt-[52px]">
        {posters.length > 0 ? (
          <div className="group relative w-full max-w-[430px] shadow-[0_30px_70px_rgba(20,22,19,0.22)]">
            <Swiper
              modules={[Navigation]}
              navigation={posters.length > 1 ? { prevEl: '.fest-prev', nextEl: '.fest-next' } : false}
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
                  className="fest-prev absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-white/90 text-ink opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                  aria-label="이전 포스터"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="fest-next absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-white/90 text-ink opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
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
        ) : (
          <div className="flex aspect-[3/4] w-full max-w-[430px] items-center justify-center bg-canvas-deep text-[48px] text-faint">
            ◉
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex min-w-0 flex-col pb-14 pl-16 pt-[52px]">
        <Crumb schedule={schedule} label={typeLabel} />
        <h1
          className="mt-[26px] text-[34px] font-extrabold leading-[1.35] tracking-[-0.9px] text-ink"
          style={{ textWrap: 'balance' }}
        >
          {decodeHtmlEntities(schedule.title)}
        </h1>

        {/* 팩트 시트 */}
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
      </div>

      {/* Lightbox */}
      {posters.length > 0 && (
        <Lightbox
          images={lightboxImages}
          currentIndex={lightbox.index}
          isOpen={lightbox.open}
          onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
          onIndexChange={(index) => setLightbox((prev) => ({ ...prev, index }))}
          showCounter={posters.length > 1}
          showDownload
        />
      )}
    </div>
  );
}

export default EventSection;
