import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { MobileLightbox } from '@/components/common';
import { decodeHtmlEntities, Fact, formatFactDate, VenueMap } from './utils';

/**
 * 행사(대학 축제 등) 섹션 — 에디토리얼 (D_final_event_mobile 시안)
 */
function MobileEventSection({ schedule }) {
  const posters = schedule.posters || [];
  const postUrls = schedule.postUrls || [];
  const venue = schedule.venue || null;

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const lightboxImages = posters.map((p) => p.originalUrl || p.mediumUrl);
  const openLightbox = (index) => {
    setLightbox({ open: true, index });
  };

  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  return (
    <div className="pb-16">
      {/* 포스터 */}
      {posters.length > 0 && (
        <div className="px-11 pt-[26px]">
          <button type="button" onClick={() => openLightbox(0)} className="block w-full">
            <img
              src={posters[0].mediumUrl || posters[0].originalUrl}
              alt={schedule.title}
              className="block w-full shadow-[0_20px_48px_rgba(20,22,19,0.2)]"
            />
          </button>
          {posters.length > 1 && (
            <div className="mt-3.5 grid grid-cols-4 gap-1.5">
              {posters.slice(1).map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openLightbox(idx + 1)}
                  className="block aspect-square overflow-hidden border border-hairline"
                >
                  <img src={p.thumbUrl || p.mediumUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-[22px] pt-[26px]">
        {/* 제목 */}
        <h1
          className="text-[24px] font-extrabold leading-[1.35] tracking-[-0.6px] text-ink"
          style={{ textWrap: 'balance' }}
        >
          {decodeHtmlEntities(schedule.title)}
        </h1>

        {/* 팩트 시트 */}
        <div className="mt-[22px] border-t-2 border-ink">
          <Fact k="DATE">{formatFactDate(schedule.date, schedule.time)}</Fact>
          {venue && (
            <Fact k="VENUE">
              {venue.name}
              {venue.address && (
                <span className="mt-[2px] block text-[13px] font-medium text-mute">{venue.address}</span>
              )}
            </Fact>
          )}
          {postUrls.length > 0 && (
            <Fact k="LINKS">
              <span className="flex flex-wrap gap-1.5">
                {postUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 border border-hairline px-2.5 py-1.5 text-[13px] font-bold text-esub"
                  >
                    {linkLabel(url)}
                    <ExternalLink size={10} />
                  </a>
                ))}
              </span>
            </Fact>
          )}
        </div>

        {/* 카카오맵 */}
        <VenueMap venue={venue} />
      </div>

      {/* Lightbox */}
      {posters.length > 0 && (
        <MobileLightbox
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

export default MobileEventSection;
