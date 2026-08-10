/**
 * 유틸리티 함수 통합 export
 */

// className 유틸리티
export { cn } from './cn';

// 날짜 관련
export {
  getTodayKST,
  formatDate,
  isSameDay,
  isToday,
  formatFullDate,
  formatXDateTime,
  formatXDateTimeWithTime,
  extractDate,
  extractTime,
  nextBirthday,
  isUpcoming,
  calcDday,
  dayjs,
} from './date';

// 포맷팅 관련
export {
  decodeHtmlEntities,
  formatTime,
  parseCredits,
  calculateTotalDuration,
  formatVideoDuration,
  uid,
  slugify,
  formatIntervalMinutes,
} from './format';

// YouTube 관련
export {
  getYoutubeVideoId,
} from './youtube';

// 스케줄 관련
export {
  getCategoryId,
  getCategoryInfo,
  getScheduleDate,
  getScheduleTime,
  groupSchedulesByDate,
} from './schedule';

// 애니메이션 관련
export { fireBirthdayConfetti, fireDebutConfetti } from './confetti';

// 검색어 강조
export { highlightTerm } from './highlight';
