import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = 'Asia/Seoul';

/**
 * UTC Date를 KST dayjs 객체로 변환
 */
export function toKST(date) {
  return dayjs(date).tz(KST);
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷 (KST)
 */
export function formatDate(date) {
  return dayjs(date).tz(KST).format('YYYY-MM-DD');
}

/**
 * 시간을 HH:mm:ss 형식으로 포맷 (KST)
 */
export function formatTime(date) {
  return dayjs(date).tz(KST).format('HH:mm:ss');
}

/**
 * 현재 KST 시간을 ISO 형식으로 반환
 * 예: "2025-01-23T13:05:00+09:00"
 */
export function nowKST() {
  return dayjs().tz(KST).format();
}

/**
 * 날짜/시각을 'YYYY-MM-DD HH:mm:ss' 형식으로 포맷 (KST)
 */
export function formatDateTime(date) {
  return toKST(date).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 오늘 날짜 (KST, 'YYYY-MM-DD')
 */
export function todayKST() {
  return toKST(new Date()).format('YYYY-MM-DD');
}

/**
 * 'YYYY-MM-DD'(또는 Date)의 요일 (0=일 … 6=토, KST 기준)
 */
export function weekdayOf(date) {
  return toKST(typeof date === 'string' ? date.slice(0, 10) : date).day();
}

/**
 * 기준일로부터 다음 특정 요일 날짜 (KST, 'YYYY-MM-DD')
 * @param {number} targetDay 목표 요일 (0=일 … 6=토)
 * @param {number} weeksAhead 몇 주 뒤 (1=다음, 2=2주 뒤 격주 …)
 * @param {Date} fromDate 기준 (기본: 지금)
 */
export function nextWeekday(targetDay, weeksAhead = 1, fromDate = new Date()) {
  const base = toKST(fromDate);
  let daysUntil = targetDay - base.day() + 7;
  if (daysUntil <= 0) daysUntil += 7;
  daysUntil += (Math.max(1, weeksAhead) - 1) * 7;
  return base.add(daysUntil, 'day').format('YYYY-MM-DD');
}

/**
 * Nitter 날짜 문자열 파싱
 * 예: "Jan 15, 2026 · 10:30 PM UTC"
 */
export function parseNitterDateTime(timeStr) {
  if (!timeStr) return null;
  const cleaned = timeStr.replace(' · ', ' ').replace(' UTC', '');
  const date = new Date(cleaned + ' UTC');
  return isNaN(date.getTime()) ? null : date;
}
