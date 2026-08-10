/**
 * 봇 설정 옵션 상수 (PC 다이얼로그 · 모바일 폼 공용)
 */

/** 상시 폴링 간격 (분) — YouTube·X 공통 */
export const BOT_INTERVAL_OPTIONS = [
  { value: 1, label: '1분' },
  { value: 2, label: '2분' },
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
];

/** 축제 봇 동기화 간격 (분) */
export const FESTIVAL_INTERVAL_OPTIONS = [
  { value: 60, label: '1시간' },
  { value: 180, label: '3시간' },
  { value: 360, label: '6시간' },
  { value: 720, label: '12시간' },
  { value: 1440, label: '24시간' },
];

/** weekly 모드 폴링 간격 (초) */
export const WEEKLY_INTERVAL_OPTIONS = [
  { value: 10, label: '10초' },
  { value: 30, label: '30초' },
  { value: 60, label: '1분' },
  { value: 120, label: '2분' },
  { value: 300, label: '5분' },
];

/** weekly 모드 지속 시간 (분) */
export const WEEKLY_DURATION_OPTIONS = [
  { value: 10, label: '10분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
];

/** 요일 옵션 (월~일 순서 표시, value는 cron 표준 0=일 ~ 6=토) */
export const DAY_OPTIONS = [
  { value: 1, label: '월요일' },
  { value: 2, label: '화요일' },
  { value: 3, label: '수요일' },
  { value: 4, label: '목요일' },
  { value: 5, label: '금요일' },
  { value: 6, label: '토요일' },
  { value: 0, label: '일요일' },
];

/** 예정 일정 생성 주기 (몇 주 뒤 — 격주/3주 콘텐츠 대응) */
export const WEEKS_OPTIONS = [
  { value: 1, label: '다음 주 (매주)' },
  { value: 2, label: '2주 뒤 (격주)' },
  { value: 3, label: '3주 뒤' },
  { value: 4, label: '4주 뒤' },
];

/** 시간 옵션 (00:00 ~ 23:00) */
export const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: `${String(i).padStart(2, '0')}:00`,
  label: `${String(i).padStart(2, '0')}:00`,
}));

/** 유튜브 봇 영상 카테고리 (영상 페이지 분류) */
export const VIDEO_CATEGORY_OPTIONS = [
  { value: 'official', label: '본채널' },
  { value: 'sp', label: '스프' },
  { value: 'variety', label: '예능 · 기타' },
  { value: 'music', label: '무대 · 퍼포먼스' },
];
