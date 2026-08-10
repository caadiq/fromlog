/**
 * 세트리스트 섹션 (회차별 탭) — 에디토리얼 리뉴얼
 * - 회차별로 독립적인 세트리스트
 * - 다른 회차에서 복사 기능
 */
import { useState, useRef, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { Search, Copy, ChevronDown, GripVertical } from 'lucide-react';

import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { F } from '@/components/pc/admin';
import { useClickOutside } from '@/hooks/common';
import SongSearchDialog from './SongSearchDialog';

function SetlistSection({ rounds, setlists, setSetlists, members, albums }) {
  const containerRef = useRef(null);
  const [activeRoundId, setActiveRoundId] = useState(rounds[0]?.id || 1);

  // 현재 활성 회차의 세트리스트
  const setlist = setlists[activeRoundId] || [];

  // 활성 회차가 삭제되면 첫 번째 회차로 전환
  useEffect(() => {
    if (!rounds.find((r) => r.id === activeRoundId) && rounds.length > 0) {
      setActiveRoundId(rounds[0].id);
    }
  }, [rounds, activeRoundId]);

  // 다음 ID 계산
  const getNextId = () => {
    return Object.values(setlists).flat().reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
  };

  // 현재 회차의 세트리스트 업데이트
  const updateCurrentSetlist = (updater) => {
    setSetlists((prev) => ({
      ...prev,
      [activeRoundId]: typeof updater === 'function' ? updater(prev[activeRoundId] || []) : updater,
    }));
  };

  // 삭제 확인 다이얼로그
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    songId: null,
    songName: null,
  });

  // 곡 검색 다이얼로그
  const [songSearchOpen, setSongSearchOpen] = useState(false);

  // 복사 소스 선택
  const [copyFrom, setCopyFrom] = useState(null);

  // 회차 드롭다운 열림 상태
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const roundDropdownRef = useRef(null);

  // 드롭다운 외부 클릭 닫기
  useClickOutside(roundDropdownRef, () => setRoundDropdownOpen(false), roundDropdownOpen);

  // 직접 입력 곡 추가
  const addSong = () => {
    const newSong = {
      id: getNextId(),
      songName: '',
      albumName: '',
      memberIds: members.map((m) => m.id),
    };
    updateCurrentSetlist((prev) => [...prev, newSong]);

    setTimeout(() => {
      if (containerRef.current) {
        const lastChild = containerRef.current.lastElementChild;
        if (lastChild) {
          lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  };

  // 검색에서 선택한 곡 추가
  const addSongsFromSearch = (songs) => {
    let id = getNextId();
    const newSongs = songs.map((song) => ({
      id: id++,
      songName: song.songName,
      albumName: song.albumName,
      memberIds: members.map((m) => m.id),
    }));
    updateCurrentSetlist((prev) => [...prev, ...newSongs]);

    setTimeout(() => {
      if (containerRef.current) {
        const lastChild = containerRef.current.lastElementChild;
        if (lastChild) {
          lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  };

  // 다른 회차에서 복사
  const copyFromRound = (sourceRoundId) => {
    const source = setlists[sourceRoundId] || [];
    let id = getNextId();
    const copied = source.map((s) => ({
      ...s,
      id: id++,
      memberIds: [...s.memberIds],
    }));
    updateCurrentSetlist(copied);
    setCopyFrom(null);
  };

  // 곡 삭제 시도
  const handleRemoveSong = (id) => {
    if (setlist.length <= 1) return;
    const song = setlist.find((s) => s.id === id);
    if (song && (song.songName || song.albumName)) {
      setDeleteConfirm({ isOpen: true, songId: id, songName: song.songName || '제목 없음' });
    } else {
      removeSong(id);
    }
  };

  // 곡 삭제 실행
  const removeSong = (id) => {
    updateCurrentSetlist((prev) => prev.filter((s) => s.id !== id));
  };

  // 삭제 확인
  const handleConfirmDelete = () => {
    if (deleteConfirm.songId !== null) {
      removeSong(deleteConfirm.songId);
    }
    setDeleteConfirm({ isOpen: false, songId: null, songName: null });
  };

  // 곡 필드 업데이트
  const updateSong = (id, field, value) => {
    updateCurrentSetlist((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // 곡별 멤버 토글
  const toggleSongMember = (songId, memberId) => {
    updateCurrentSetlist((prev) =>
      prev.map((s) => {
        if (s.id !== songId) return s;
        const has = s.memberIds.includes(memberId);
        return {
          ...s,
          memberIds: has ? s.memberIds.filter((id) => id !== memberId) : [...s.memberIds, memberId],
        };
      })
    );
  };

  // 곡별 멤버 전체 선택/해제
  const toggleAllSongMembers = (songId) => {
    updateCurrentSetlist((prev) =>
      prev.map((s) => {
        if (s.id !== songId) return s;
        const allSelected = members.every((m) => s.memberIds.includes(m.id));
        return {
          ...s,
          memberIds: allSelected ? [] : members.map((m) => m.id),
        };
      })
    );
  };

  // 현재 활성 회차의 인덱스
  const activeRoundIndex = rounds.findIndex((r) => r.id === activeRoundId);

  return (
    <>
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, songId: null, songName: null })}
        onConfirm={handleConfirmDelete}
        title="곡 삭제"
        message={
          <p>
            <span className="font-medium">{deleteConfirm.songName}</span>
            을(를) 삭제하시겠습니까?
          </p>
        }
        confirmText="삭제"
        cancelText="취소"
      />

      <SongSearchDialog
        isOpen={songSearchOpen}
        onClose={() => setSongSearchOpen(false)}
        onSelect={addSongsFromSearch}
        albums={albums}
      />

      <div>
        <div className={`${F.section} flex items-baseline`}>
          <span>
            SETLIST{setlist.length > 0 && <span className="ml-1.5 text-primary">{setlist.length}</span>}
          </span>
          {/* 다른 회차에서 복사 */}
          {rounds.length > 1 && (
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setCopyFrom(copyFrom ? null : true)}
                className="flex items-center gap-1.5 text-[12.5px] font-extrabold tracking-k1 text-mute transition-colors hover:text-ink"
              >
                <Copy size={11} />
                다른 회차에서 복사
              </button>
              {copyFrom && (
                <div className="absolute right-0 top-full z-10 mt-1.5 min-w-[120px] border border-ink bg-white py-1">
                  {rounds
                    .filter((r) => r.id !== activeRoundId)
                    .map((r) => {
                      const roundIdx = rounds.indexOf(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => copyFromRound(r.id)}
                          className="w-full px-4 py-2 text-left text-[14px] font-semibold text-ebody transition-colors hover:bg-canvas"
                        >
                          {roundIdx + 1}회차
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 회차 선택 커스텀 드롭다운 (2개 이상일 때만) */}
        {rounds.length > 1 && (
          <div className="relative mt-[18px] w-52" ref={roundDropdownRef}>
            <button
              type="button"
              onClick={() => setRoundDropdownOpen(!roundDropdownOpen)}
              className="flex w-full items-center justify-between gap-2 border border-hairline bg-white px-3.5 py-2.5 text-[14px] font-bold text-ink transition-colors hover:border-ink"
            >
              <span className="truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {activeRoundIndex + 1}회차
                {rounds[activeRoundIndex]?.date ? ` (${rounds[activeRoundIndex].date})` : ''}
              </span>
              <ChevronDown
                size={14}
                className={`text-mute transition-transform ${roundDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {roundDropdownOpen && (
              <div className="absolute left-0 top-full z-10 mt-1.5 w-full border border-ink bg-white py-1">
                {rounds.map((round, index) => (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => {
                      setActiveRoundId(round.id);
                      setRoundDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-[14px] font-semibold transition-colors ${
                      round.id === activeRoundId ? 'bg-ink text-white' : 'text-ebody hover:bg-canvas'
                    }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {index + 1}회차{round.date ? ` (${round.date})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Reorder.Group
          axis="y"
          values={setlist}
          onReorder={(next) => updateCurrentSetlist(next)}
          ref={containerRef}
          className="mt-[18px] flex flex-col gap-3"
        >
          {setlist.map((song, index) => (
            <Reorder.Item
              key={song.id}
              value={song}
              className="flex cursor-grab items-stretch overflow-hidden border border-hairline bg-white active:cursor-grabbing"
            >
              {/* 드래그 핸들 (시각적 표시용, 카드 전체가 드래그 가능) */}
              <div className="flex items-center px-2 text-faint">
                <GripVertical size={17} />
              </div>
              <div className="min-w-0 flex-1 py-[18px] pr-[22px]">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold tracking-k2 text-mute">
                    TRACK {String(index + 1).padStart(2, '0')}
                  </span>
                  {setlist.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSong(song.id)}
                      className="text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
                    >
                      삭제
                    </button>
                  )}
                </div>

                {/* 곡명 & 앨범명 */}
                <div className="mt-3.5 grid grid-cols-2 gap-5">
                  <div>
                    <label className={F.label}>곡명 *</label>
                    <input
                      type="text"
                      value={song.songName}
                      onChange={(e) => updateSong(song.id, 'songName', e.target.value)}
                      placeholder="예: Feel Good"
                      className="mt-1 w-full border-b-2 border-ink bg-transparent px-0.5 pb-2 pt-1.5 text-[15px] font-bold text-ink placeholder-faint outline-none"
                    />
                  </div>
                  <div>
                    <label className={F.label}>앨범명 (선택)</label>
                    <input
                      type="text"
                      value={song.albumName}
                      onChange={(e) => updateSong(song.id, 'albumName', e.target.value)}
                      placeholder="예: Unlock My World"
                      className="mt-1 w-full border-b-2 border-ink bg-transparent px-0.5 pb-2 pt-1.5 text-[15px] font-bold text-ink placeholder-faint outline-none"
                    />
                  </div>
                </div>

                {/* 참여 멤버 */}
                <div className="mt-4">
                  <label className={F.label}>참여 멤버</label>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleAllSongMembers(song.id)}
                      className={`px-3 py-[7px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                        members.every((m) => song.memberIds.includes(m.id))
                          ? 'bg-ink text-white'
                          : 'border border-hairline bg-white text-esub hover:border-ink'
                      }`}
                    >
                      {members.every((m) => song.memberIds.includes(m.id)) ? '전체 해제' : '전체 선택'}
                    </button>
                    {members.map((member) => {
                      const isSelected = song.memberIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleSongMember(song.id, member.id)}
                          className={`flex items-center gap-2 border py-1 pl-1 pr-3 transition-colors ${
                            isSelected ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
                          }`}
                        >
                          <span className="h-7 w-7 flex-shrink-0 overflow-hidden bg-canvas">
                            {member.image_url ? (
                              <img src={member.image_url} alt={member.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="block h-full w-full bg-faint-light" />
                            )}
                          </span>
                          <span className="text-[13px] font-bold">{member.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setSongSearchOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 border border-ink bg-white py-3 text-[13px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
          >
            <Search size={12} strokeWidth={2.5} />
            곡 검색
          </button>
          <button
            type="button"
            onClick={addSong}
            className="flex flex-1 items-center justify-center gap-1.5 border border-dashed border-faint bg-white py-3 text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
          >
            + 직접 입력
          </button>
        </div>

        <p className="mt-2.5 text-[13px] text-mute">
          {rounds.length > 1
            ? "회차별로 세트리스트를 다르게 입력할 수 있습니다. '다른 회차에서 복사'로 빠르게 시작하세요."
            : '곡 추가 시 전체 멤버가 자동으로 선택됩니다. 솔로/유닛 곡은 개별 조정하세요.'}
        </p>
      </div>
    </>
  );
}

export default SetlistSection;
