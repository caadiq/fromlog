import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Info, Users, Tag, Disc3 } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual } from 'swiper/modules';
import 'swiper/css';
import LightboxIndicator from './LightboxIndicator';
import { useDialogBackClose } from '@/hooks/common';

/**
 * 모바일 라이트박스 공통 컴포넌트
 * Swiper 기반 터치 스와이프 지원
 *
 * @param {string[]} images - 이미지/비디오 URL 배열
 * @param {Object[]} photos - 메타데이터 포함 사진 배열 (선택적)
 *   @param {string} photos[].concept - 컨셉 이름
 *   @param {string} photos[].members - 멤버 이름 (쉼표 구분)
 *   @param {string} photos[].albumTitle - 출처 앨범명
 * @param {Object[]} teasers - 티저 정보 배열 (비디오 여부 확인용)
 *   @param {string} teasers[].media_type - 'video' 또는 'image'
 * @param {number} currentIndex - 현재 인덱스
 * @param {boolean} isOpen - 열림 상태
 * @param {function} onClose - 닫기 콜백
 * @param {function} onIndexChange - 인덱스 변경 콜백
 * @param {boolean} showCounter - 카운터 표시 여부 (기본: true)
 * @param {boolean} showDownload - 다운로드 버튼 표시 여부 (기본: true)
 * @param {string} downloadPrefix - 다운로드 파일명 접두사 (기본: 'fromis9_photo')
 */
function MobileLightbox({
  images,
  photos,
  teasers,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
  showCounter = true,
  showDownload = true,
  downloadPrefix = 'fromis9_photo',
}) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const [showInfo, setShowInfo] = useState(false);
  // 정보 다이얼로그가 열려 있으면 뒤로가기로 정보창부터 닫기 (LIFO)
  useDialogBackClose(showInfo, () => setShowInfo(false));
  const swiperRef = useRef(null);

  // 현재 사진 정보
  const currentPhoto = photos?.[currentIndex];
  const concept = currentPhoto?.concept || currentPhoto?.title;
  const hasValidConcept = concept && concept.trim() && concept !== 'Default';
  const members = currentPhoto?.members;
  const hasMembers = members && String(members).trim();
  const albumTitle = currentPhoto?.albumTitle;
  const hasAlbum = albumTitle && String(albumTitle).trim();
  const hasPhotoInfo = hasValidConcept || hasMembers || hasAlbum;

  // 정보 시트 열기 (히스토리는 useDialogBackClose가 담당)
  const openInfo = useCallback(() => {
    setShowInfo(true);
  }, []);

  // 이미지 다운로드
  const downloadImage = useCallback(async () => {
    const imageUrl = images?.[currentIndex];
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${downloadPrefix}_${String(currentIndex + 1).padStart(2, '0')}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('다운로드 오류:', error);
    }
  }, [images, currentIndex, downloadPrefix]);

  // 바디 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 라이트박스 닫힐 때 정보 시트도 닫기
  useEffect(() => {
    if (!isOpen) {
      setShowInfo(false);
    }
  }, [isOpen]);

  // 이미지가 없으면 렌더링하지 않음
  if (!images?.length) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black z-[60] flex flex-col"
        >
          {/* 상단 헤더 */}
          <div className="absolute top-0 left-0 right-0 flex items-center px-4 py-3 z-20">
            <div className="flex-1 flex justify-start">
              <button onClick={onClose} className="text-white/80 p-1">
                <X size={24} />
              </button>
            </div>
            {showCounter && images.length > 1 && (
              <span className="text-white/70 text-[15px] tabular-nums">
                {currentIndex + 1} / {images.length}
              </span>
            )}
            <div className="flex-1 flex justify-end items-center gap-2">
              {hasPhotoInfo && (
                <button onClick={openInfo} className="text-white/80 p-1">
                  <Info size={22} />
                </button>
              )}
              {showDownload && (
                <button onClick={downloadImage} className="text-white/80 p-1">
                  <Download size={22} />
                </button>
              )}
            </div>
          </div>

          {/* Swiper */}
          <Swiper
            modules={[Virtual]}
            virtual
            initialSlide={currentIndex}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            onSlideChange={(swiper) => onIndexChange(swiper.activeIndex)}
            className="w-full h-full"
            spaceBetween={0}
            slidesPerView={1}
            resistance={true}
            resistanceRatio={0.5}
          >
            {images.map((url, index) => (
              <SwiperSlide key={index} virtualIndex={index}>
                <div className="w-full h-full flex items-center justify-center">
                  {teasers?.[index]?.media_type === 'video' ? (
                    <video
                      src={url}
                      className="max-w-full max-h-full object-contain"
                      controls
                      autoPlay={index === currentIndex}
                    />
                  ) : (
                    <img
                      src={url}
                      alt=""
                      className="max-w-full max-h-full object-contain"
                      loading={Math.abs(index - currentIndex) <= 2 ? 'eager' : 'lazy'}
                    />
                  )}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* 인디케이터 */}
          {images.length > 1 && (
            <LightboxIndicator
              count={images.length}
              currentIndex={currentIndex}
              goToIndex={(i) => swiperRef.current?.slideTo(i)}
              width={120}
            />
          )}

          {/* 사진 정보 바텀시트 */}
          <AnimatePresence>
            {showInfo && hasPhotoInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 z-30"
                onClick={() => setShowInfo(false)}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.5 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 300) {
                      setShowInfo(false);
                    }
                  }}
                  className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 드래그 핸들 */}
                  <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1 bg-zinc-600 rounded-full" />
                  </div>

                  {/* 정보 내용 */}
                  <div className="px-5 pb-8 space-y-4">
                    <h3 className="text-white font-semibold text-lg">사진 정보</h3>

                    {hasMembers && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-zinc-400 text-[13.5px] mb-1">멤버</p>
                          <p className="text-white">{members}</p>
                        </div>
                      </div>
                    )}

                    {hasValidConcept && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Tag size={16} className="text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-zinc-400 text-[13.5px] mb-1">컨셉</p>
                          <p className="text-white">{concept}</p>
                        </div>
                      </div>
                    )}

                    {hasAlbum && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Disc3 size={16} className="text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-zinc-400 text-[13.5px] mb-1">앨범</p>
                          <p className="text-white">{albumTitle}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default MobileLightbox;
