/**
 * 포맷팅 관련 유틸리티 함수
 */

/**
 * HTML 엔티티 매핑
 */
const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

/**
 * HTML 엔티티 디코딩 (순수 함수 - SSR 호환)
 * @param {string} text - HTML 엔티티가 포함된 텍스트
 * @returns {string} 디코딩된 텍스트
 */
export const decodeHtmlEntities = (text) => {
  if (!text) return '';
  return text.replace(
    /&(?:amp|lt|gt|quot|#39|apos|#x27|nbsp);/g,
    (match) => HTML_ENTITIES[match] || match
  );
};

/**
 * 시간 문자열 포맷팅 (HH:mm 형식으로)
 * @param {string} time - 시간 문자열 (HH:mm:ss 또는 HH:mm)
 * @returns {string|null} 포맷된 시간 또는 null
 */
export const formatTime = (time) => {
  if (!time) return null;
  return time.slice(0, 5);
};

/**
 * 크레딧 텍스트를 배열로 분리
 * @param {string} text - 쉼표로 구분된 크레딧 텍스트
 * @returns {string[]} 크레딧 배열
 */
export const parseCredits = (text) => {
  if (!text) return [];
  return text.split(',').map(item => item.trim()).filter(Boolean);
};

/**
 * 트랙 목록의 총 재생 시간 계산
 * @param {Array<{duration?: string}>} tracks - 트랙 배열 (duration: "MM:SS" 형식)
 * @returns {string} 총 재생 시간 ("MM:SS" 형식)
 */
export const calculateTotalDuration = (tracks) => {
  if (!tracks || !Array.isArray(tracks)) return '';

  const totalSeconds = tracks.reduce((acc, track) => {
    if (!track.duration) return acc;
    const parts = track.duration.split(':');
    if (parts.length !== 2) return acc;
    return acc + parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }, 0);

  if (totalSeconds === 0) return '';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * 영상 길이(초) → "M:SS" / 1시간 이상이면 "H:MM:SS"
 * 값이 없으면(라이브 스트림·백필 전) 빈 문자열 — 호출부에서 배지를 그리지 않는다
 * @param {number|null} seconds
 * @returns {string}
 */
export const formatVideoDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/**
 * 클라이언트 전용 고유 id 생성 (리스트 key 등)
 * crypto.randomUUID는 secure context(https) 전용이라 http 개발 환경 fallback 포함
 */
export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * 제목 → RustFS 폴더명 slug (소문자·한글·숫자·하이픈만)
 */
export const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[\s.]+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * 봇 동기화 간격(분) → 사람이 읽는 라벨 (분/시간/일)
 */
export const formatIntervalMinutes = (minutes, empty = '-') => {
  if (!minutes) return empty;
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}일`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}시간`;
  return `${minutes}분`;
};
