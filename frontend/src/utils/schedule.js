/**
 * 스케줄 관련 유틸리티 함수
 */
import { extractDate, extractTime } from './date';

/**
 * 스케줄에서 카테고리 ID 추출
 * 검색 결과와 일반 데이터의 형식 차이를 처리
 * @param {object} schedule - 스케줄 객체
 * @returns {number|null} 카테고리 ID
 */
export function getCategoryId(schedule) {
  return schedule.category?.id ?? schedule.category_id ?? schedule.categoryId ?? null;
}

/**
 * 스케줄에서 카테고리 정보 추출
 * @param {object} schedule - 스케줄 객체
 * @returns {{ id: number, name: string, color: string }}
 */
export function getCategoryInfo(schedule) {
  return {
    id: getCategoryId(schedule),
    name: schedule.category?.name ?? schedule.category_name ?? schedule.categoryName ?? '미분류',
    color: schedule.category?.color ?? schedule.category_color ?? schedule.categoryColor ?? '#9CA3AF',
  };
}

/**
 * 스케줄에서 날짜 추출
 * @param {object} schedule - 스케줄 객체
 * @returns {string} YYYY-MM-DD 형식 날짜
 */
export function getScheduleDate(schedule) {
  return schedule.date || '';
}

/**
 * 스케줄에서 시간 추출
 * @param {object} schedule - 스케줄 객체
 * @returns {string|null} HH:mm 형식 시간 또는 null
 */
export function getScheduleTime(schedule) {
  if (schedule.time) {
    return schedule.time.slice(0, 5);
  }
  return null;
}

/**
 * 날짜별로 스케줄 그룹화
 * @param {Array} schedules - 스케줄 배열
 * @returns {Map<string, Array>} 날짜별 그룹화된 맵
 */
export function groupSchedulesByDate(schedules) {
  const groups = new Map();

  for (const schedule of schedules) {
    const date = getScheduleDate(schedule);
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date).push(schedule);
  }

  return groups;
}

