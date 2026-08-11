/**
 * 스케줄 관련 유틸리티 함수
 */
import { extractDate, extractTime } from './date';
import { CATEGORY_IDS } from '@/constants';

/**
 * 안내(공지) 일정인지 판별
 *
 * X 일정 제목은 트윗 첫 문단을 그대로 가져오는데, 소스 계정이 표식을 붙이는
 * 관습이 있다(💌 소식 · 📺 영상 · 💡 편성 · 📢 안내 …). 이 중 📢만
 * "팬이 실제로 행동해야 하는 안내"(인원체크·재모임·사전판매 등)라 목록에서 강조한다.
 *
 * 위치는 따지지 않는다 — `[📢] …` 뿐 아니라 `📢 …`(대괄호 없음),
 * `… MD NOTICE 📢`(끝), 리트윗 본문 안에 있는 경우까지 실제로 전부 안내였다.
 * 카테고리는 X로 한정해 다른 일정 제목에 우연히 들어가도 오작동하지 않게 한다.
 *
 * @param {object} schedule - 스케줄 객체
 * @returns {boolean}
 */
export function isNoticeSchedule(schedule) {
  if (!schedule || getCategoryId(schedule) !== CATEGORY_IDS.X) return false;
  return (schedule.title ?? '').includes('📢');
}

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

