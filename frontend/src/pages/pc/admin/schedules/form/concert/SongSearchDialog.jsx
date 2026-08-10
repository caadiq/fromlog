import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Music, Disc3 } from "lucide-react";
import { useDialogBackClose } from '@/hooks/common';

/**
 * 곡 검색 다이얼로그
 * - 앨범 목록에서 곡을 검색/선택
 * - 다중 선택 지원
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSelect - 선택된 곡 배열 반환 [{ songName, albumName }]
 * @param {Array} props.albums - getAlbums() 결과
 */
function SongSearchDialog({ isOpen, onClose, onSelect, albums }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTracks, setSelectedTracks] = useState([]);

  // 전체 트랙 목록 (앨범 정보 포함)
  const allTracks = useMemo(() => {
    if (!albums || albums.length === 0) return [];
    return albums.flatMap((album) =>
      (album.tracks || []).map((track) => ({
        id: `${album.id}-${track.id}`,
        songName: track.title,
        albumName: album.title,
        albumCover: album.cover_thumb_url,
        isTitleTrack: track.is_title_track,
        trackNumber: track.track_number,
      }))
    );
  }, [albums]);

  // 검색 필터링
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return allTracks;
    const query = searchQuery.toLowerCase();
    return allTracks.filter(
      (track) =>
        track.songName.toLowerCase().includes(query) ||
        track.albumName.toLowerCase().includes(query)
    );
  }, [allTracks, searchQuery]);

  // 앨범별 그룹핑
  const groupedTracks = useMemo(() => {
    const groups = {};
    filteredTracks.forEach((track) => {
      if (!groups[track.albumName]) {
        groups[track.albumName] = {
          albumName: track.albumName,
          albumCover: track.albumCover,
          tracks: [],
        };
      }
      groups[track.albumName].tracks.push(track);
    });
    return Object.values(groups);
  }, [filteredTracks]);

  // 트랙 선택 토글
  const toggleTrack = (track) => {
    setSelectedTracks((prev) => {
      const exists = prev.find((t) => t.id === track.id);
      if (exists) {
        return prev.filter((t) => t.id !== track.id);
      }
      return [...prev, track];
    });
  };

  // 선택 순서 매핑 (trackId → 순번)
  const selectionOrder = useMemo(() => {
    const m = new Map();
    selectedTracks.forEach((t, i) => m.set(t.id, i + 1));
    return m;
  }, [selectedTracks]);

  const isSelected = (trackId) => selectionOrder.has(trackId);

  // 확인
  const handleConfirm = () => {
    onSelect(
      selectedTracks.map((t) => ({
        songName: t.songName,
        albumName: t.albumName,
      }))
    );
    handleClose();
  };

  // 닫기
  const handleClose = () => {
    setSearchQuery("");
    setSelectedTracks([]);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="mx-4 flex h-[60vh] min-h-[400px] w-full max-w-lg flex-col border border-ink bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">곡 검색</h3>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-faint transition-colors hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* 검색 입력 */}
            <div className="relative mb-4">
              <Search
                size={15}
                strokeWidth={2.5}
                className="absolute left-0.5 top-1/2 -translate-y-1/2 text-mute"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="곡명 또는 앨범명으로 검색"
                className="w-full border-b-2 border-ink bg-transparent py-2.5 pl-7 pr-2 text-[14.5px] font-semibold text-ink placeholder-faint outline-none"
                autoFocus
              />
            </div>

            {/* 선택 카운트 */}
            {selectedTracks.length > 0 && (
              <div className="mb-3 text-[13px] font-extrabold text-primary">
                {selectedTracks.length}곡 선택됨
              </div>
            )}

            {/* 결과 목록 */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {groupedTracks.length > 0 ? (
                <div className="space-y-4">
                  {groupedTracks.map((group) => (
                    <div key={group.albumName}>
                      {/* 앨범 헤더 */}
                      <div className="sticky top-0 mb-1.5 flex items-center gap-2.5 border-b border-hairline bg-white py-1.5">
                        {group.albumCover ? (
                          <img
                            src={group.albumCover}
                            alt={group.albumName}
                            className="h-8 w-8 object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center bg-canvas">
                            <Disc3 size={15} className="text-mute" />
                          </div>
                        )}
                        <span className="text-[13px] font-extrabold text-ink">
                          {group.albumName}
                        </span>
                      </div>

                      {/* 트랙 목록 */}
                      <div className="space-y-1">
                        {group.tracks.map((track) => {
                          const order = selectionOrder.get(track.id);
                          const selected = order !== undefined;
                          return (
                            <button
                              key={track.id}
                              type="button"
                              onClick={() => toggleTrack(track)}
                              className={`flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors ${
                                selected ? "bg-green-soft/60" : "hover:bg-canvas"
                              }`}
                            >
                              <div
                                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center text-[12px] font-extrabold leading-none transition-colors ${
                                  selected
                                    ? "bg-ink text-white"
                                    : "border border-hairline text-transparent"
                                }`}
                              >
                                <span className="translate-y-[0.5px]">{order ?? ""}</span>
                              </div>
                              <span className="w-5 flex-shrink-0 text-right text-[12.5px] font-bold text-mute" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {track.trackNumber}
                              </span>
                              <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">
                                {track.songName}
                              </span>
                              {!!track.isTitleTrack && (
                                <span className="flex-shrink-0 bg-green-soft px-1.5 py-0.5 text-[12px] font-extrabold tracking-k1 text-green-deep">
                                  TITLE
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-[13px] font-semibold text-mute">
                  <Music size={28} className="mx-auto mb-2 text-faint" />
                  <p>
                    {searchQuery
                      ? "검색 결과가 없습니다"
                      : "등록된 곡이 없습니다"}
                  </p>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-hairline pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="border border-hairline bg-white px-4 py-2 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedTracks.length === 0}
                className="bg-ink px-4 py-2 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody disabled:opacity-50"
              >
                {selectedTracks.length > 0
                  ? `${selectedTracks.length}곡 추가`
                  : "추가"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default SongSearchDialog;
