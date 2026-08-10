/**
 * 장소 검색 다이얼로그 컴포넌트
 * - 국내: 카카오맵 API
 * - 해외: 구글맵 API
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, MapPin, Globe } from "lucide-react";
import useAuthStore from "@/stores/useAuthStore";
import { useDialogBackClose } from '@/hooks/common';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - 다이얼로그 열림 여부
 * @param {Function} props.onClose - 닫기 핸들러
 * @param {Function} props.onSelect - 장소 선택 핸들러 ({ name, address, country, lat, lng })
 */
function VenueSearchDialog({ isOpen, onClose, onSelect }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const [region, setRegion] = useState("domestic"); // domestic | overseas
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // 다이얼로그 닫기 시 상태 초기화
  const handleClose = () => {
    setSearchQuery("");
    setResults([]);
    setError(null);
    onClose();
  };

  // 지역 변경 시 결과 초기화
  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);
    setResults([]);
    setError(null);
  };

  // 검색 실행
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const token = useAuthStore.getState().token;

      if (region === "domestic") {
        // 카카오맵 API
        const response = await fetch(
          `/api/admin/kakao/places?query=${encodeURIComponent(searchQuery)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const places = (data.documents || []).map((place) => ({
            id: place.id,
            name: place.place_name,
            address: place.road_address_name || place.address_name,
            country: "South Korea",
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            category: place.category_name,
          }));
          setResults(places);
        } else {
          setError("검색 중 오류가 발생했습니다.");
        }
      } else {
        // 구글맵 API
        const response = await fetch(
          `/api/admin/google/places?query=${encodeURIComponent(searchQuery)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const places = (data.results || []).map((place) => ({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            country: extractCountry(place.formatted_address),
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            category: place.types?.[0]?.replace(/_/g, " "),
          }));
          setResults(places);
        } else {
          setError("검색 중 오류가 발생했습니다.");
        }
      }
    } catch (err) {
      console.error("장소 검색 오류:", err);
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  };

  // 주소에서 국가 추출 (구글맵용)
  const extractCountry = (address) => {
    if (!address) return "";
    const parts = address.split(", ");
    return parts[parts.length - 1] || "";
  };

  // 장소 선택
  const handleSelectPlace = (place) => {
    onSelect({
      name: place.name,
      address: place.address,
      country: place.country,
      lat: place.lat,
      lng: place.lng,
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
            {/* 헤더 */}
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

            {/* 지역 선택 탭 */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => handleRegionChange("domestic")}
                className={`flex flex-1 items-center justify-center gap-2 border py-2.5 text-[13px] font-extrabold tracking-k1 transition-colors ${
                  region === "domestic"
                    ? "border-ink bg-ink text-white"
                    : "border-hairline bg-white text-esub hover:border-ink hover:text-ink"
                }`}
              >
                <MapPin size={14} />
                국내
              </button>
              <button
                type="button"
                onClick={() => handleRegionChange("overseas")}
                className={`flex flex-1 items-center justify-center gap-2 border py-2.5 text-[13px] font-extrabold tracking-k1 transition-colors ${
                  region === "overseas"
                    ? "border-ink bg-ink text-white"
                    : "border-hairline bg-white text-esub hover:border-ink hover:text-ink"
                }`}
              >
                <Globe size={14} />
                해외
              </button>
            </div>

            {/* 검색 입력 */}
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  strokeWidth={2.5}
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 text-mute"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder={
                    region === "domestic"
                      ? "장소명을 입력하세요 (예: 올림픽홀)"
                      : "장소명을 입력하세요 (예: Tokyo Dome)"
                  }
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
                      ease: "linear",
                    }}
                  >
                    <Search size={15} />
                  </motion.div>
                ) : (
                  "검색"
                )}
              </button>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-4 bg-[#F9E9E7] px-3.5 py-3 text-[13px] font-bold text-[#C0392B]">
                {error}
              </div>
            )}

            {/* 검색 결과 */}
            <div className="max-h-80 overflow-y-auto">
              {results.length > 0 ? (
                <div className="divide-y divide-hairline border-t-2 border-ink">
                  {results.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => handleSelectPlace(place)}
                      className="flex w-full items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-canvas"
                    >
                      <MapPin
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-mute"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-extrabold text-ink">{place.name}</p>
                        <p className="truncate text-[13px] font-semibold text-esub">
                          {place.address}
                        </p>
                        {place.category && (
                          <p className="mt-1 text-[12px] text-mute">
                            {place.category}
                          </p>
                        )}
                      </div>
                      {region === "overseas" && place.country && (
                        <span className="flex-shrink-0 text-[12px] font-bold text-mute">
                          {place.country}
                        </span>
                      )}
                    </button>
                  ))}
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

export default VenueSearchDialog;
