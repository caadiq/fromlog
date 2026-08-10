import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { MobileLightbox } from '@/components/common';
import { decodeHtmlEntities, Fact, formatFactDate, roundDate, VenueMap } from './utils';

const COLLAPSE_COUNT = 6;

/**
 * 콘서트 섹션 — 에디토리얼 (D_final_concert_mobile 시안)
 */
function MobileConcertSection({ schedule }) {
  const navigate = useNavigate();
  const poster = schedule.poster || null;
  const venue = schedule.venue || null;
  const setlist = schedule.setlist || [];
  const merchandise = schedule.merchandise || [];
  const otherRounds = schedule.otherRounds || [];
  const activeCount = schedule.activeMemberCount || 5;

  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [expanded, setExpanded] = useState(false);

  const openLightbox = (images, index) => {
    setLightbox({ open: true, images, index });
  };
  const isUnit = (m) => m.length > 0 && m.length < activeCount;
  const posterImg = poster ? (poster.mediumUrl || poster.originalUrl) : null;

  const allRounds = [
    { scheduleId: schedule.id, date: schedule.date, time: schedule.time, current: true },
    ...otherRounds.map((r) => ({ ...r, current: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const hasMultiRounds = allRounds.length > 1;

  const collapsible = setlist.length > COLLAPSE_COUNT;
  const visibleSetlist = collapsible && !expanded ? setlist.slice(0, COLLAPSE_COUNT) : setlist;

  return (
    <div className="pb-16">
      {/* 포스터 */}
      <div className="px-14 pt-[26px]">
        {posterImg ? (
          <button
            type="button"
            onClick={() => openLightbox([poster.originalUrl || poster.mediumUrl], 0)}
            className="block w-full"
          >
            <img
              src={posterImg}
              alt={`${schedule.title} 포스터`}
              className="block w-full shadow-[0_20px_48px_rgba(20,22,19,0.22)]"
            />
          </button>
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-canvas-deep">
            <Ticket size={40} className="text-faint" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="px-[22px] pt-[26px]">
        {/* 제목 */}
        <h1
          className="text-[23px] font-extrabold leading-[1.35] tracking-[-0.5px] text-ink"
          style={{ textWrap: 'balance' }}
        >
          {decodeHtmlEntities(schedule.title)}
        </h1>

        {/* 회차 탭 */}
        {hasMultiRounds && (
          <div className="mt-4 flex gap-1.5">
            {allRounds.map((round) => (
              <button
                key={round.scheduleId}
                type="button"
                onClick={() => {
                  if (!round.current) navigate(`/schedule/${round.scheduleId}`, { replace: true });
                }}
                className={`flex-1 border py-2.5 text-center ${
                  round.current ? 'border-ink bg-ink text-white' : 'border-hairline text-esub'
                }`}
              >
                <b className="block text-[14.5px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {roundDate(round.date)}
                </b>
                <span className={`text-[12px] font-bold tracking-k1 ${round.current ? 'text-white/80' : 'text-mute'}`}>
                  {round.time ? round.time.slice(0, 5) : '시간 미정'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 팩트 시트 */}
        <div className="mt-5 border-t-2 border-ink">
          <Fact k="DATE">{formatFactDate(schedule.date, schedule.time)}</Fact>
          {venue && (
            <Fact k="VENUE">
              {venue.name}
              {venue.address && (
                <span className="mt-[2px] block text-[13px] font-medium text-mute">{venue.address}</span>
              )}
            </Fact>
          )}
        </div>

        {/* 카카오맵 */}
        <VenueMap venue={venue} heightClass="h-[170px]" />

        {/* SETLIST */}
        {setlist.length > 0 && (
          <div className="mt-7">
            <div className="border-t-2 border-ink pt-3.5 text-[13px] font-extrabold tracking-k3 text-ink">
              SETLIST — {setlist.length}
            </div>
            <div>
              {visibleSetlist.map((song, idx) => (
                <div
                  key={song.id}
                  className="grid grid-cols-[34px_1fr] items-baseline border-b border-hairline px-0.5 py-3"
                >
                  <span
                    className="text-[13px] font-extrabold text-faint"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[15px] font-bold tracking-[-0.2px] text-ink">
                        {song.songName}
                      </span>
                      {song.albumName && (
                        <span className="shrink-0 text-[13px] text-mute">{song.albumName}</span>
                      )}
                    </span>
                    {isUnit(song.members) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {song.members.map((m) => (
                          <span key={m.id} className="bg-green-soft px-1.5 py-0.5 text-[12.5px] font-bold text-green-deep">
                            {m.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {collapsible && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full py-3.5 text-center text-[12.5px] font-extrabold tracking-k2 text-primary"
                >
                  {expanded ? '접기 ↑' : `전체 ${setlist.length}곡 펼치기 ↓`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* MD */}
        {merchandise.length > 0 && (
          <div className="mt-7">
            <div className="border-t-2 border-ink pt-3.5 text-[13px] font-extrabold tracking-k3 text-ink">MD</div>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {merchandise.map((md, idx) => (
                <button
                  key={md.id}
                  type="button"
                  onClick={() => openLightbox(merchandise.map((x) => x.originalUrl || x.mediumUrl), idx)}
                  className="block w-full border border-hairline"
                >
                  <img src={md.mediumUrl || md.thumbUrl} alt="" className="block aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <MobileLightbox
        images={lightbox.images}
        currentIndex={lightbox.index}
        isOpen={lightbox.open}
        onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
        onIndexChange={(index) => setLightbox((prev) => ({ ...prev, index }))}
        showCounter={lightbox.images.length > 1}
        showDownload
      />
    </div>
  );
}

export default MobileConcertSection;
