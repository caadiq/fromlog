import useAdminModal from '@/hooks/common/useAdminModal';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion, useDragControls } from 'framer-motion';
import { X, Download, Info, Users, Tag, Disc3 } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual } from 'swiper/modules';
import 'swiper/css';
import LightboxIndicator from './LightboxIndicator';
import { useDialogBackClose } from '@/hooks/common';

function ViewerMedia({ url, video, active, label }) {
  const [failed, setFailed] = useState(!url);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || loaded || failed) return undefined;
    const timer = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(timer);
  }, [active, loaded, failed, attempt]);
  if (failed) return <div role="alert" className="px-6 text-center text-white">
    <p>미디어를 불러오지 못했습니다.</p>
    <button className="mt-4 border border-white/50 px-4 py-2" onClick={() => { setFailed(!url); setLoaded(false); setAttempt(v => v + 1); }}>다시 시도</button>
  </div>;
  if (video) return active ? <video key={attempt} src={url} controls autoPlay playsInline onLoadedData={() => setLoaded(true)} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" /> : null;
  return <img key={attempt} src={url} alt={label} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />;
}

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
}) {
  const panelRef = useRef(null);
  const infoRef = useRef(null);
  const infoDrag = useDragControls();
  const reduceMotion = useReducedMotion();
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef(null);
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const [showInfo, setShowInfo] = useState(false);
  // 정보 다이얼로그가 열려 있으면 뒤로가기로 정보창부터 닫기 (LIFO)
  useDialogBackClose(showInfo, () => setShowInfo(false));
  const swiperRef = useRef(null);
  useAdminModal(isOpen, panelRef, onClose);
  useAdminModal(isOpen && showInfo, infoRef, () => setShowInfo(false));
  useEffect(() => {
    setDownloadError('');
    setDownloading(false);
    return () => { const controller = downloadRef.current; downloadRef.current = null; controller?.abort(); };
  }, [isOpen, currentIndex, images?.[currentIndex]]);

  // 현재 사진 정보
  const currentPhoto = photos?.[currentIndex];
  const concept = currentPhoto?.concept || currentPhoto?.title;
  const hasValidConcept = concept && concept.trim() && concept.toLowerCase() !== 'default';
  const members = currentPhoto?.members;
  const hasMembers = members && String(members).trim();
  const albumTitle = currentPhoto?.albumTitle;
  const hasAlbum = albumTitle && String(albumTitle).trim();
  const hasPhotoInfo = hasValidConcept || hasMembers || hasAlbum;

  // 정보 시트 열기 (히스토리는 useDialogBackClose가 담당)
  const openInfo = useCallback(() => {
    setShowInfo(true);
  }, []);

  // Download the original asset and preserve its file type.
  const downloadImage = useCallback(async () => {
    const imageUrl = photos?.[currentIndex]?.original_url || images[currentIndex];
    if (!imageUrl || downloadRef.current) return;
    const controller = new AbortController();
    downloadRef.current = controller;
    setDownloading(true);
    setDownloadError('');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(imageUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      if (/text\/html|application\/json/.test(blob.type)) throw new Error('Invalid media');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = decodeURIComponent(new URL(imageUrl, window.location.href).pathname.split('/').pop()) || `media_${currentIndex + 1}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (downloadRef.current === controller) setDownloadError('다운로드하지 못했습니다. 다시 시도해주세요.');
    } finally {
      clearTimeout(timeout);
      if (downloadRef.current === controller) { downloadRef.current = null; setDownloading(false); }
    }
  }, [images, photos, currentIndex]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
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
          ref={panelRef}
          tabIndex={-1}
          aria-modal="true"
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduceMotion ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          role="dialog" aria-label="이미지 뷰어"
          className="fixed inset-0 bg-black z-[60] flex flex-col"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* 상단 헤더 */}
          <div className="shrink-0 flex items-center px-4 py-2 z-20">
            <div className="flex-1 flex justify-start">
              <button onClick={onClose} aria-label="이미지 뷰어 닫기" className="flex h-11 w-11 items-center justify-center text-white/80">
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
                <button onClick={openInfo} aria-label="사진 정보" className="flex h-11 w-11 items-center justify-center text-white/80">
                  <Info size={22} />
                </button>
              )}
              {showDownload && (
                <button onClick={downloadImage} disabled={downloading} aria-label={downloading ? "다운로드 중" : "이미지 다운로드"} className="flex h-11 w-11 items-center justify-center text-white/80">
                  <Download size={22} />
                </button>
              )}
            </div>
          </div>

          {downloadError && <p role="alert" className="shrink-0 px-4 py-2 text-center text-[13px] text-white">{downloadError}</p>}
          {/* Swiper */}
          <Swiper
            modules={[Virtual]}
            virtual
            speed={reduceMotion ? 0 : 300}
            initialSlide={currentIndex}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            onSlideChange={(swiper) => onIndexChange(swiper.activeIndex)}
            className="w-full min-h-0 flex-1"
            spaceBetween={0}
            slidesPerView={1}
            resistance={true}
            resistanceRatio={0.5}
          >
            {images.map((url, index) => (
              <SwiperSlide key={index} virtualIndex={index}>
                <div className="w-full h-full flex items-center justify-center">
                  <ViewerMedia key={url} url={url} video={teasers?.[index]?.media_type === 'video'} active={index === currentIndex} label={`사진 ${index + 1}`} />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* 인디케이터 */}
          {images.length > 1 && (
            <div className="relative z-20 h-14 shrink-0">
            <LightboxIndicator
              count={images.length}
              currentIndex={currentIndex}
              goToIndex={(i) => swiperRef.current?.slideTo(i)}
              width={120}
            />
            </div>
          )}

          {/* 사진 정보 바텀시트 */}
          <AnimatePresence>
            {showInfo && hasPhotoInfo && (
              <motion.div
                initial={{ opacity: reduceMotion ? 1 : 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: reduceMotion ? 1 : 0 }}
                className="absolute inset-0 bg-black/60 z-30"
                onClick={() => setShowInfo(false)}
              >
                <motion.div
                  initial={{ y: reduceMotion ? 0 : '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: reduceMotion ? 0 : '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  dragControls={infoDrag}
                  dragListener={false}
                  drag={reduceMotion ? false : "y"}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.5 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 300) {
                      setShowInfo(false);
                    }
                  }}
                  ref={infoRef}
                  tabIndex={-1}
                  role="dialog" aria-modal="true" aria-label="사진 정보"
                  className="absolute bottom-0 left-0 right-0 max-h-[80dvh] overflow-y-auto overscroll-contain break-words bg-zinc-900 rounded-t-3xl safe-area-bottom"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 드래그 핸들 */}
                  <div onPointerDown={event => infoDrag.start(event)} style={{ touchAction: 'none' }} className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1 bg-zinc-600 rounded-full" />
                  </div>

                  {/* 정보 내용 */}
                  <div className="px-5 pb-8 space-y-4">
                    <div className="flex items-center justify-between"><h3 className="text-white font-semibold text-lg">사진 정보</h3><button onClick={() => setShowInfo(false)} aria-label="사진 정보 닫기" className="flex h-11 w-11 items-center justify-center text-white"><X size={22} /></button></div>

                    {hasMembers && (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users size={16} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-zinc-400 text-[13.5px] mb-1">멤버</p>
                          <p className="text-white">{members}</p>
                        </div>
                      </div>
                    )}

                    {hasValidConcept && (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Tag size={16} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-zinc-400 text-[13.5px] mb-1">컨셉</p>
                          <p className="text-white">{concept}</p>
                        </div>
                      </div>
                    )}

                    {hasAlbum && (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Disc3 size={16} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0">
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
