import { useEffect, useRef } from 'react';

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

let kakaoLoadPromise = null;

/** 앱과 동일한 에디토리얼 잉크 물방울 핀(가운데 흰 원) 마커 이미지 */
function buildPinImage(kakao) {
  const w = 27;
  const h = 40;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 17 25">` +
    `<path d="M8.5 25 L15.43 13 A8 8 0 1 0 1.57 13 Z" fill="#141613"/>` +
    `<circle cx="8.5" cy="9" r="3.36" fill="#ffffff"/></svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(w, h), {
    offset: new kakao.maps.Point(w / 2, h),
  });
}

/**
 * Kakao Maps JavaScript SDK 1회 로드 (애플리케이션 전체에서 공유)
 */
function loadKakaoSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('window unavailable'));
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (kakaoLoadPromise) return kakaoLoadPromise;

  kakaoLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error('Kakao SDK loaded but window.kakao.maps missing'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'));
    document.head.appendChild(script);
  });

  return kakaoLoadPromise;
}

/**
 * Kakao 지도 + 마커 렌더링
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} name - 마커에 표시할 이름 (선택)
 * @param {string} className - 컨테이너 클래스
 * @param {number} level - 지도 확대 레벨 (기본 3)
 */
function KakaoMap({ lat, lng, name, className, level = 3 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!lat || !lng || !containerRef.current) return;
    let cancelled = false;

    loadKakaoSdk()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        const center = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(containerRef.current, { center, level });
        const marker = new kakao.maps.Marker({
          position: center,
          image: buildPinImage(kakao),
          map,
        });
        if (name) {
          const overlay = new kakao.maps.CustomOverlay({
            position: center,
            yAnchor: 2.2,
            content: `<div style="padding:4px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:9999px;font-size:12px;color:#374151;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.05);">${name}</div>`,
          });
          overlay.setMap(map);
        }
      })
      .catch((err) => {
        console.error('KakaoMap 로드 실패:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, level]);

  return <div ref={containerRef} className={className} />;
}

export default KakaoMap;
