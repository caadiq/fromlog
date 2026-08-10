/**
 * 장소 검색 다이얼로그 컴포넌트
 * - 카카오 장소 검색 API를 사용
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MapPin } from 'lucide-react';
import useAuthStore from '@/stores/useAuthStore';
import { useDialogBackClose } from '@/hooks/common';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 다이얼로그 열림 여부
 * @param {Function} props.onClose - 닫기 핸들러
 * @param {Function} props.onSelect - 장소 선택 핸들러 (place 객체 전달)
 */
function LocationSearchDialog({ isOpen, onClose, onSelect }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // 다이얼로그 닫기 시 상태 초기화
  const handleClose = () => {
    setSearchQuery('');
    setResults([]);
    onClose();
  };

  // 카카오 장소 검색 API 호출
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`/api/admin/kakao/places?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.documents || []);
      }
    } catch (error) {
      console.error('장소 검색 오류:', error);
    } finally {
      setSearching(false);
    }
  };

  // 장소 선택
  const handleSelectPlace = (place) => {
    onSelect({
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
    });
    handleClose();
  };

  return (
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
            className="mx-4 w-full max-w-lg border border-ink bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">장소 검색</h3>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-faint transition-colors hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* 검색 입력 */}
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-0.5 top-1/2 -translate-y-1/2 text-mute" strokeWidth={2.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="장소명을 입력하세요"
                  className="w-full border-b-2 border-ink bg-transparent py-2.5 pl-7 pr-2 text-[14.5px] font-semibold text-ink placeholder-faint outline-none"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="bg-ink px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody disabled:opacity-50"
              >
                {searching ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <Search size={15} />
                  </motion.div>
                ) : (
                  '검색'
                )}
              </button>
            </div>

            {/* 검색 결과 */}
            <div className="max-h-80 overflow-y-auto pr-1">
              {results.length > 0 ? (
                <div className="divide-y divide-hairline border-t-2 border-ink">
                  {results.map((place, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectPlace(place)}
                      className="flex w-full items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-canvas"
                    >
                      <MapPin size={16} className="mt-0.5 flex-shrink-0 text-mute" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-extrabold text-ink">{place.place_name}</p>
                        <p className="truncate text-[13px] font-semibold text-esub">
                          {place.road_address_name || place.address_name}
                        </p>
                        {place.category_name && (
                          <p className="mt-1 text-[12px] text-mute">{place.category_name}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery && !searching ? (
                <div className="py-9 text-center text-[13px] font-semibold text-mute">
                  <MapPin size={28} className="mx-auto mb-2 text-faint" />
                  <p>검색어를 입력하고 검색 버튼을 눌러주세요</p>
                </div>
              ) : (
                <div className="py-9 text-center text-[13px] font-semibold text-mute">
                  <MapPin size={28} className="mx-auto mb-2 text-faint" />
                  <p>장소명을 입력하고 검색해주세요</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LocationSearchDialog;
