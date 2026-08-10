import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Info, Tag, Users } from 'lucide-react';
import LightboxIndicator from './LightboxIndicator';
import { useDialogBackClose } from '@/hooks/common';

/**
 * 라이트박스 공통 컴포넌트
 * 이미지/비디오 갤러리를 전체 화면으로 표시
 *
 * @param {string[]} images - 이미지/비디오 URL 배열
 * @param {Object[]} photos - 메타데이터 포함 사진 배열 (선택적)
 *   @param {string} photos[].title - 컨셉 이름
 *   @param {string} photos[].members - 멤버 이름 (쉼표 구분)
 * @param {Object[]} teasers - 티저 정보 배열 (비디오 여부 확인용)
 *   @param {string} teasers[].media_type - 'video' 또는 'image'
 * @param {number} currentIndex - 현재 인덱스
 * @param {boolean} isOpen - 열림 상태
 * @param {function} onClose - 닫기 콜백
 * @param {function} onIndexChange - 인덱스 변경 콜백
 * @param {boolean} showCounter - 카운터 표시 여부 (기본: true)
 * @param {boolean} showDownload - 다운로드 버튼 표시 여부 (기본: true)
 */
function Lightbox({
  images,
  photos,
  teasers,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
  showCounter = true,
  showDownload = true,
}) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [slideDirection, setSlideDirection] = useState(0);
  // 정보(컨셉·멤버) 표시 토글 — 모바일처럼 버튼 눌렀을 때만 노출
  const [showInfo, setShowInfo] = useState(false);
  // 정보 다이얼로그가 열려 있으면 뒤로가기로 정보창부터 닫기 (LIFO)
  useDialogBackClose(showInfo, () => setShowInfo(false));

  // X·배경·Escape 닫기 (히스토리 정리는 useDialogBackClose가 담당)
  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);
  // 이미지 확대 (클릭 토글, 확대 중 마우스 위치 따라 패닝)
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  const updateZoomOrigin = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  // 이전/다음 네비게이션
  const goToPrev = useCallback(() => {
    if (images.length <= 1) return;
    setImageLoaded(false);
    setSlideDirection(-1);
    onIndexChange((currentIndex - 1 + images.length) % images.length);
  }, [images.length, currentIndex, onIndexChange]);

  const goToNext = useCallback(() => {
    if (images.length <= 1) return;
    setImageLoaded(false);
    setSlideDirection(1);
    onIndexChange((currentIndex + 1) % images.length);
  }, [images.length, currentIndex, onIndexChange]);

  const goToIndex = useCallback(
    (index) => {
      if (index === currentIndex) return;
      setImageLoaded(false);
      setSlideDirection(index > currentIndex ? 1 : -1);
      onIndexChange(index);
    },
    [currentIndex, onIndexChange]
  );

  // 이미지 다운로드
  const downloadImage = useCallback(async () => {
    const imageUrl = images[currentIndex];
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image_${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
    }
  }, [images, currentIndex]);

  // 라이트박스 열릴 때 body 스크롤 숨기기
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 키보드 이벤트 핸들러
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          requestClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToPrev, goToNext, requestClose]);

  // 이미지가 바뀔 때 로딩/줌 상태 리셋
  useEffect(() => {
    setImageLoaded(false);
    setZoomed(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!isOpen) {
      setZoomed(false);
      setShowInfo(false);
    }
  }, [isOpen]);

  // 현재 사진의 메타데이터
  const currentPhoto = photos?.[currentIndex];
  const photoTitle = currentPhoto?.title || currentPhoto?.concept;
  const hasValidTitle = photoTitle && photoTitle.trim() && photoTitle !== 'Default';
  const photoMembers = currentPhoto?.members;
  const hasMembers = photoMembers && String(photoMembers).trim();
  const hasPhotoInfo = hasValidTitle || hasMembers;

  return createPortal(
    <AnimatePresence>
      {isOpen && images.length > 0 && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 뷰어"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/95 z-50 overflow-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onClick={requestClose}
        >
          {/* 내부 컨테이너 */}
          <div className="relative flex h-full w-full items-center justify-center">
            {/* 카운터 */}
            {showCounter && images.length > 1 && (
              <div className="absolute top-6 left-6 text-white/70 text-[15px] z-10">
                {currentIndex + 1} / {images.length}
              </div>
            )}

            {/* 상단 버튼들 */}
            <div className="absolute top-6 right-6 flex gap-3 z-10">
              {hasPhotoInfo && (
                <button
                  aria-label="사진 정보"
                  aria-pressed={showInfo}
                  className={`transition-colors ${showInfo ? 'text-white' : 'text-white/70 hover:text-white'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo((v) => !v);
                  }}
                >
                  <Info size={26} aria-hidden="true" />
                </button>
              )}
              {showDownload && (
                <button
                  aria-label="다운로드"
                  className="text-white/70 hover:text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage();
                  }}
                >
                  <Download size={28} aria-hidden="true" />
                </button>
              )}
              <button
                aria-label="닫기"
                className="text-white/70 hover:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  requestClose();
                }}
              >
                <X size={32} aria-hidden="true" />
              </button>
            </div>

            {/* 이전 버튼 */}
            {images.length > 1 && (
              <button
                aria-label="이전 이미지"
                className="absolute left-6 p-2 text-white/70 hover:text-white transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrev();
                }}
              >
                <ChevronLeft size={48} aria-hidden="true" />
              </button>
            )}

            {/* 로딩 스피너 */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
              </div>
            )}

            {/* 이미지/비디오 + 메타데이터 */}
            <div className="flex flex-col items-center mx-24">
              {teasers?.[currentIndex]?.media_type === 'video' ? (
                <motion.video
                  key={currentIndex}
                  src={images[currentIndex]}
                  className={`max-w-[min(1100px,calc(100vw-200px))] max-h-[min(900px,calc(100dvh-140px))] object-contain transition-opacity duration-200 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  onCanPlay={() => setImageLoaded(true)}
                  initial={{ x: slideDirection * 100 }}
                  animate={{ x: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  controls
                  autoPlay
                />
              ) : (
                <motion.div
                  key={currentIndex}
                  initial={{ x: slideDirection * 100 }}
                  animate={{ x: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <img
                    src={images[currentIndex]}
                    alt={`이미지 ${currentIndex + 1}`}
                    className={`max-w-[min(1100px,calc(100vw-200px))] max-h-[min(900px,calc(100dvh-140px))] object-contain transition-opacity duration-200 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    } ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                    style={{
                      transform: zoomed ? 'scale(2)' : 'none',
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                      transition: 'transform 0.25s ease',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateZoomOrigin(e);
                      setZoomed((z) => !z);
                    }}
                    onMouseMove={(e) => {
                      if (zoomed) updateZoomOrigin(e);
                    }}
                    onLoad={() => setImageLoaded(true)}
                  />
                </motion.div>
              )}

            </div>

            {/* 다음 버튼 */}
            {images.length > 1 && (
              <button
                aria-label="다음 이미지"
                className="absolute right-6 p-2 text-white/70 hover:text-white transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
              >
                <ChevronRight size={48} aria-hidden="true" />
              </button>
            )}

            {/* 인디케이터 */}
            {images.length > 1 && (
              <LightboxIndicator
                count={images.length}
                currentIndex={currentIndex}
                goToIndex={goToIndex}
              />
            )}

            {/* 사진 정보 하단 다이얼로그 */}
            <AnimatePresence>
              {showInfo && hasPhotoInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] flex items-end justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo(false);
                  }}
                >
                  <div className="absolute inset-0 bg-black/40" />
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-lg rounded-t-2xl bg-zinc-900 px-6 pb-9 pt-5 shadow-2xl"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-[17px] font-semibold text-white">사진 정보</h3>
                      <button
                        aria-label="닫기"
                        className="text-white/50 transition-colors hover:text-white"
                        onClick={() => setShowInfo(false)}
                      >
                        <X size={20} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {hasValidTitle && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                            <Tag size={16} className="text-zinc-400" />
                          </div>
                          <div>
                            <p className="mb-1 text-[13px] text-zinc-400">컨셉</p>
                            <p className="text-[15px] text-white">{photoTitle}</p>
                          </div>
                        </div>
                      )}
                      {hasMembers && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                            <Users size={16} className="text-primary" />
                          </div>
                          <div>
                            <p className="mb-1 text-[13px] text-zinc-400">멤버</p>
                            <p className="text-[15px] text-white">{String(photoMembers)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default Lightbox;
