/**
 * 공연 일정 섹션 — 에디토리얼 리뉴얼
 * - 다회차 지원 (날짜, 시간, 장소)
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, MapPin } from 'lucide-react';

import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import VenueSearchDialog from '@/components/pc/admin/common/VenueSearchDialog';
import { F } from '@/components/pc/admin';

function ScheduleSection({ rounds, setRounds }) {
  const containerRef = useRef(null);
  const [nextId, setNextId] = useState(() => {
    const maxId = rounds.reduce((max, r) => Math.max(max, r.id || 0), 0);
    return maxId + 1;
  });

  // 삭제 확인 다이얼로그
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    roundId: null,
    roundIndex: null,
  });

  // 장소 검색 다이얼로그
  const [locationSearch, setLocationSearch] = useState({
    isOpen: false,
    roundId: null,
  });

  // 장소 삭제 확인 다이얼로그
  const [venueDeleteConfirm, setVenueDeleteConfirm] = useState({
    isOpen: false,
    roundId: null,
    venueName: null,
  });

  // 회차 추가
  const addRound = () => {
    const newRound = {
      id: nextId,
      date: '',
      time: '',
      venue: null, // { name, address, lat, lng }
    };
    setRounds([...rounds, newRound]);
    setNextId(nextId + 1);

    // 새 회차로 스크롤
    setTimeout(() => {
      if (containerRef.current) {
        const lastChild = containerRef.current.lastElementChild;
        if (lastChild) {
          lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  };

  // 회차 삭제 시도
  const handleRemoveRound = (id) => {
    if (rounds.length <= 1) return;

    const round = rounds.find((r) => r.id === id);
    const roundIndex = rounds.findIndex((r) => r.id === id);

    // 입력값이 있으면 확인 다이얼로그 표시
    if (round && (round.date || round.time || round.venue)) {
      setDeleteConfirm({
        isOpen: true,
        roundId: id,
        roundIndex: roundIndex + 1,
      });
    } else {
      removeRound(id);
    }
  };

  // 회차 삭제 실행
  const removeRound = (id) => {
    setRounds(rounds.filter((round) => round.id !== id));
  };

  // 삭제 확인
  const handleConfirmDelete = () => {
    if (deleteConfirm.roundId !== null) {
      removeRound(deleteConfirm.roundId);
    }
    setDeleteConfirm({ isOpen: false, roundId: null, roundIndex: null });
  };

  // 회차 업데이트
  const updateRound = (id, field, value) => {
    setRounds(rounds.map((round) => (round.id === id ? { ...round, [field]: value } : round)));
  };

  // 장소 검색 열기
  const openLocationSearch = (roundId) => {
    setLocationSearch({ isOpen: true, roundId });
  };

  // 장소 선택
  const handleLocationSelect = (place) => {
    if (locationSearch.roundId !== null) {
      updateRound(locationSearch.roundId, 'venue', place);
    }
    setLocationSearch({ isOpen: false, roundId: null });
  };

  // 장소 삭제 시도
  const handleRemoveVenue = (roundId) => {
    const round = rounds.find((r) => r.id === roundId);
    if (round?.venue) {
      setVenueDeleteConfirm({
        isOpen: true,
        roundId,
        venueName: round.venue.name,
      });
    }
  };

  // 장소 삭제 확인
  const handleConfirmVenueDelete = () => {
    if (venueDeleteConfirm.roundId !== null) {
      updateRound(venueDeleteConfirm.roundId, 'venue', null);
    }
    setVenueDeleteConfirm({ isOpen: false, roundId: null, venueName: null });
  };

  return (
    <>
      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, roundId: null, roundIndex: null })}
        onConfirm={handleConfirmDelete}
        title="회차 삭제"
        message={
          <p>
            <span className="font-medium">{deleteConfirm.roundIndex}회차</span>에 입력된 정보가 있습니다.
            <br />
            정말 삭제하시겠습니까?
          </p>
        }
        confirmText="삭제"
        cancelText="취소"
      />

      {/* 장소 검색 다이얼로그 */}
      <VenueSearchDialog
        isOpen={locationSearch.isOpen}
        onClose={() => setLocationSearch({ isOpen: false, roundId: null })}
        onSelect={handleLocationSelect}
      />

      {/* 장소 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={venueDeleteConfirm.isOpen}
        onClose={() => setVenueDeleteConfirm({ isOpen: false, roundId: null, venueName: null })}
        onConfirm={handleConfirmVenueDelete}
        title="장소 삭제"
        message={
          <p>
            <span className="font-medium">{venueDeleteConfirm.venueName}</span>
            을(를) 삭제하시겠습니까?
          </p>
        }
        confirmText="삭제"
        cancelText="취소"
      />

      <div>
        <div className={F.section}>
          ROUNDS <span className="ml-1.5 font-bold tracking-normal text-mute">다회차 가능</span>
        </div>

        <div ref={containerRef} className="mt-[18px] flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {rounds.map((round, index) => (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, scale: 0.98, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <div className="border border-hairline bg-white px-[22px] pb-5 pt-[18px]">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-extrabold tracking-k2 text-mute">
                      ROUND {String(index + 1).padStart(2, '0')}
                    </span>
                    {rounds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRound(round.id)}
                        className="text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {/* 날짜 & 시간 */}
                  <div className="mt-4 grid grid-cols-2 gap-5">
                    <div>
                      <label className={F.label}>날짜 *</label>
                      <div className="mt-2">
                        <DatePicker
                          value={round.date}
                          onChange={(val) => updateRound(round.id, 'date', val)}
                          placeholder="날짜 선택"
                          minYear={2017}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={F.label}>시간 (선택)</label>
                      <div className="mt-2">
                        <TimePicker
                          value={round.time}
                          onChange={(val) => updateRound(round.id, 'time', val)}
                          placeholder="시간 선택"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 장소 */}
                  <div className="mt-4">
                    <label className={F.label}>장소 (선택)</label>
                    {round.venue ? (
                      <div className="mt-2 flex items-start gap-3 border border-hairline bg-paper px-4 py-3">
                        <MapPin size={15} className="mt-0.5 flex-shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="truncate text-[14.5px] font-extrabold text-ink">{round.venue.name}</p>
                            {round.venue.country && (
                              <span className="flex-shrink-0 text-[12.5px] text-mute">{round.venue.country}</span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[13px] text-mute">{round.venue.address}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVenue(round.id)}
                          className="text-faint transition-colors hover:text-[#C0392B]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openLocationSearch(round.id)}
                        className={`${F.dropzone} mt-2 w-full py-3 text-[13.5px] font-bold`}
                      >
                        ◎ 장소 검색
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={addRound}
          className="mt-3 flex w-full items-center justify-center border border-dashed border-faint bg-white py-3 text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
        >
          + 회차 추가
        </button>

        <p className="mt-2.5 text-[13px] text-mute">시간과 장소는 선택사항입니다. 미정인 경우 비워두세요.</p>
      </div>
    </>
  );
}

export default ScheduleSection;
