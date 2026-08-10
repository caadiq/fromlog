/**
 * 날짜 관련 유틸리티 함수
 * dayjs를 사용하여 KST(한국 표준시) 기준으로 날짜 처리
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TIMEZONE, WEEKDAYS } from '@/constants';

// 플러그인 확장
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * KST 기준 오늘 날짜 (YYYY-MM-DD)
 * @returns {string} 오늘 날짜 문자열
 */
export const getTodayKST = () => {
  return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
};

/**
 * 날짜 문자열 포맷팅
 * @param {string|Date} date - 날짜
 * @param {string} format - 포맷 (기본: 'YYYY-MM-DD')
 * @returns {string} 포맷된 날짜 문자열
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '';
  return dayjs(date).tz(TIMEZONE).format(format);
};

/**
 * 두 날짜 비교 (같은 날인지)
 * @param {string|Date} date1
 * @param {string|Date} date2
 * @returns {boolean}
 */
export const isSameDay = (date1, date2) => {
  return (
    dayjs(date1).tz(TIMEZONE).format('YYYY-MM-DD') ===
    dayjs(date2).tz(TIMEZONE).format('YYYY-MM-DD')
  );
};

/**
 * 날짜가 오늘인지 확인
 * @param {string|Date} date
 * @returns {boolean}
 */
export const isToday = (date) => {
  return isSameDay(date, dayjs());
};

/**
 * 전체 날짜 포맷 (YYYY. M. D. (요일))
 * @param {string|Date} date - 날짜
 * @returns {string} 포맷된 문자열
 */
export const formatFullDate = (date) => {
  if (!date) return '';
  const d = dayjs(date).tz(TIMEZONE);
  return `${d.year()}. ${d.month() + 1}. ${d.date()}. (${WEEKDAYS[d.day()]})`;
};

/**
 * X(트위터) 스타일 날짜/시간 포맷팅
 * @param {string} datetime - datetime 문자열 (YYYY-MM-DDTHH:mm:ss 또는 YYYY-MM-DD)
 * @returns {string} "오후 7:00 · 2026년 1월 18일" 또는 "2026년 1월 18일"
 */
export const formatXDateTime = (datetime) => {
  if (!datetime) return '';

  const d = dayjs(datetime).tz(TIMEZONE);
  const datePart = `${d.year()}년 ${d.month() + 1}월 ${d.date()}일`;

  // datetime에 T가 포함되고 시간이 00:00:00이 아니면 시간 표시
  if (datetime.includes('T') && !datetime.endsWith('T00:00:00')) {
    const hours = d.hour();
    const minutes = d.minute();
    // 00:00인 경우 시간 표시 안함
    if (hours !== 0 || minutes !== 0) {
      const period = hours < 12 ? '오전' : '오후';
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${period} ${hour12}:${String(minutes).padStart(2, '0')} · ${datePart}`;
    }
  }

  return datePart;
};

/**
 * X(트위터) 스타일 날짜/시간 포맷팅 (time 필드 분리 버전)
 * @param {string} date - 날짜 문자열 (YYYY-MM-DD)
 * @param {string|null} time - 시간 문자열 (HH:mm:ss) 또는 null
 * @returns {string} "오후 7:00 · 2026년 1월 18일" 또는 "2026년 1월 18일"
 */
export const formatXDateTimeWithTime = (date, time) => {
  if (!date) return '';

  const d = dayjs(date).tz(TIMEZONE);
  const datePart = `${d.year()}년 ${d.month() + 1}월 ${d.date()}일`;

  // time이 있으면 시간 표시
  if (time) {
    const [hourStr, minuteStr] = time.split(':');
    const hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);
    const period = hours < 12 ? '오전' : '오후';
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${period} ${hour12}:${String(minutes).padStart(2, '0')} · ${datePart}`;
  }

  return datePart;
};

/**
 * datetime 문자열에서 date 추출
 * @param {string} datetime - "YYYY-MM-DD HH:mm" 또는 "YYYY-MM-DD"
 * @returns {string} "YYYY-MM-DD"
 */
export const extractDate = (datetime) => {
  if (!datetime) return '';
  return datetime.split(' ')[0].split('T')[0];
};

/**
 * datetime 문자열에서 time 추출
 * @param {string} datetime - "YYYY-MM-DD HH:mm" 또는 "YYYY-MM-DDTHH:mm"
 * @returns {string|null} "HH:mm" 또는 null
 */
export const extractTime = (datetime) => {
  if (!datetime) return null;
  if (datetime.includes(' ')) {
    return datetime.split(' ')[1]?.slice(0, 5) || null;
  }
  if (datetime.includes('T')) {
    return datetime.split('T')[1]?.slice(0, 5) || null;
  }
  return null;
};

/**
 * 다음 생일까지 D-day + 날짜
 * @param {string} birthDate - 생일 (YYYY-MM-DD 형식 문자열)
 * @returns {{dday: string, date: string}|null} D-day 문자열과 다음 생일 날짜 표기
 */
export function nextBirthday(birthDate) {
  if (!birthDate) return null;
  const [, m, d] = birthDate.slice(0, 10).split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  const diff = Math.round((next - today) / 86400000);
  const weekday = WEEKDAYS[next.getDay()];
  return {
    dday: diff === 0 ? 'D-DAY' : `D-${diff}`,
    date: `${next.getFullYear()}. ${String(m).padStart(2, '0')}. ${String(d).padStart(2, '0')} (${weekday})`,
  };
}

/**
 * 발매 전(오늘 이후) 여부
 * @param {string|Date} releaseDate - 발매일
 * @returns {boolean}
 */
export function isUpcoming(releaseDate) {
  if (!releaseDate) return false;
  const d = new Date(releaseDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

/**
 * D-day 계산 (오늘 기준, 일 단위)
 * @param {string|Date} releaseDate - 대상 날짜
 * @returns {number|null} 남은 일수 (지났으면 음수), 값이 없으면 null
 */
export function calcDday(releaseDate) {
  if (!releaseDate) return null;
  const release = new Date(releaseDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  release.setHours(0, 0, 0, 0);
  return Math.round((release - today) / 86400000);
}

// dayjs 인스턴스도 export (고급 사용용)
export { dayjs };
