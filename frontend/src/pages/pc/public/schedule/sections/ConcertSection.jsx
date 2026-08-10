import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { Lightbox, KakaoMap } from '@/components/common';
import { WEEKDAYS } from '@/constants';
import { decodeHtmlEntities } from './utils';
import Crumb from './Crumb';

const COLLAPSE_COUNT = 6;

function roundDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
}

/**
 * PC 콘서트 상세 — 에디토리얼 리뉴얼 (D_final_concert_pc 시안)
 * 상단: 좌 포스터 | 우 크럼·제목·회차 탭·VENUE·카카오맵
 * 하단: SETLIST(접기/펼치기) | MD 2열
 */
function ConcertSection({ schedule }) {
  const navigate = useNavigate();
  const poster = schedule.poster || null;
  const venue = schedule.venue || null;
  const setlist = schedule.setlist || [];
  const merchandise = schedule.merchandise || [];
  const otherRounds = schedule.otherRounds || [];
  const activeCount = schedule.activeMemberCount || 5;

  const kakaoMapUrl = venue && venue.lat && venue.lng
    ? `https://map.kakao.com/link/map/${encodeURIComponent(venue.name)},${venue.lat},${venue.lng}`
    : null;

  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [expanded, setExpanded] = useState(false);

  const openLightbox = (images, index) => setLightbox({ open: true, images, index });
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ===== 상단 스프레드 ===== */}
      <div className="border-b border-hairline">
        <div className="mx-auto grid w-full max-w-[1300px] grid-cols-[1fr_1.05fr] px-[70px]">
          {/* 포스터 */}
          <div className="flex items-start justify-center border-r border-hairline px-16 pb-16 pt-[52px]">
            {posterImg ? (
              <button
                type="button"
                onClick={() => openLightbox([poster.originalUrl || poster.mediumUrl], 0)}
                className="block w-full max-w-[430px] cursor-zoom-in shadow-[0_30px_70px_rgba(20,22,19,0.22)]"
              >
                <img src={posterImg} alt={`${schedule.title} 포스터`} className="block h-auto w-full" />
              </button>
            ) : (
              <div className="flex aspect-[3/4] w-full max-w-[430px] items-center justify-center bg-canvas-deep">
                <Ticket size={48} className="text-faint" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="flex min-w-0 flex-col pb-14 pl-16 pt-[52px]">
            <Crumb schedule={schedule} />
            <h1
              className="mt-6 text-[34px] font-extrabold leading-[1.35] tracking-[-0.8px] text-ink"
              style={{ textWrap: 'balance' }}
            >
              {decodeHtmlEntities(schedule.title)}
            </h1>

            {/* 회차 탭 */}
            {hasMultiRounds && (
              <div className="mt-[22px] flex gap-2">
                {allRounds.map((round) => (
                  <button
                    key={round.scheduleId}
                    type="button"
                    onClick={() => {
                      if (!round.current) navigate(`/schedule/${round.scheduleId}`, { replace: true });
                    }}
                    className={`flex-1 border py-3 text-center transition-colors ${
                      round.current
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline text-esub hover:border-ink hover:text-ink'
                    }`}
                  >
                    <b className="block text-[16px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {roundDate(round.date)}
                    </b>
                    <span className={`text-[13px] font-bold tracking-k1 ${round.current ? 'text-white/80' : 'text-mute'}`}>
                      {round.time ? round.time.slice(0, 5) : '시간 미정'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* VENUE 팩트 */}
            {venue && (
              <div className="mt-6 border-t-2 border-ink">
                <div className="grid grid-cols-[120px_1fr] items-baseline border-b border-hairline px-0.5 py-[15px]">
                  <span className="text-[13px] font-extrabold tracking-k25 text-mute">VENUE</span>
                  <span className="text-[16.5px] font-semibold leading-[1.6] text-ink">
                    {venue.name}
                    {venue.address && (
                      <span className="mt-[3px] block text-[14.5px] font-medium text-mute">{venue.address}</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* 카카오맵 */}
            {venue && venue.lat && venue.lng && (
              <div className="relative mt-6 border border-hairline">
                <KakaoMap
                  lat={Number(venue.lat)}
                  lng={Number(venue.lng)}
                  name={venue.name}
                  className="h-[170px] w-full"
                />
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
        </div>
      </div>

      {/* ===== 하단: 세트리스트 | MD ===== */}
      {(setlist.length > 0 || merchandise.length > 0) && (
        <div className="mx-auto w-full max-w-[1300px] px-[70px]">
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-[70px] pb-[90px] pt-[50px]">
            {/* SETLIST */}
            {setlist.length > 0 && (
              <div>
                <div className="mb-3.5 border-t-2 border-ink pt-4 text-[15px] font-extrabold tracking-[3.5px] text-ink">
                  SETLIST — {setlist.length}
                </div>
                <div>
                  {visibleSetlist.map((song, idx) => (
                    <div
                      key={song.id}
                      className="grid grid-cols-[44px_1fr] items-baseline border-b border-hairline px-0.5 py-3"
                    >
                      <span
                        className="text-[14.5px] font-extrabold text-faint"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-2.5">
                          <span className="truncate text-[16.5px] font-bold tracking-[-0.2px] text-ink">
                            {song.songName}
                          </span>
                          {song.albumName && (
                            <span className="shrink-0 text-[14.5px] text-mute">{song.albumName}</span>
                          )}
                        </span>
                        {isUnit(song.members) && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {song.members.map((m) => (
                              <span
                                key={m.id}
                                className="bg-green-soft px-2 py-0.5 text-[13.5px] font-bold text-green-deep"
                              >
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
                      className="w-full py-4 text-center text-[13.5px] font-extrabold tracking-k2 text-primary transition-colors hover:text-green-deep"
                    >
                      {expanded ? '접기 ↑' : `전체 ${setlist.length}곡 펼치기 ↓`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* MD */}
            {merchandise.length > 0 && (
              <div>
                <div className="mb-3.5 border-t-2 border-ink pt-4 text-[15px] font-extrabold tracking-[3.5px] text-ink">
                  MD
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {merchandise.map((md, idx) => (
                    <button
                      key={md.id}
                      type="button"
                      onClick={() => openLightbox(merchandise.map((x) => x.originalUrl || x.mediumUrl), idx)}
                      className="block w-full cursor-zoom-in border border-hairline transition-opacity hover:opacity-90"
                    >
                      <img src={md.mediumUrl || md.thumbUrl} alt="" className="block aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
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

export default ConcertSection;
