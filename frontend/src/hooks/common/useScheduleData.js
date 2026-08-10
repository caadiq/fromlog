import { useQuery } from '@tanstack/react-query';
import { scheduleApi } from '@/api';

/**
 * 스케줄 목록 조회 훅 (월별)
 * @param {number} year - 년도
 * @param {number} month - 월 (1-12)
 */
export function useScheduleData(year, month) {
  return useQuery({
    queryKey: ['schedules', year, month],
    queryFn: () => scheduleApi.getSchedules(year, month),
    enabled: !!year && !!month,
  });
}

/**
 * 스케줄 상세 조회 훅
 * @param {number} id - 스케줄 ID
 */
export function useScheduleDetail(id) {
  return useQuery({
    queryKey: ['schedule', id],
    queryFn: () => scheduleApi.getSchedule(id),
    enabled: !!id,
  });
}

/**
 * 다가오는 스케줄 조회 훅
 * @param {number} limit - 조회 개수
 */
export function useUpcomingSchedules(limit = 3) {
  return useQuery({
    queryKey: ['schedules', 'upcoming', limit],
    queryFn: () => scheduleApi.getUpcomingSchedules(limit),
  });
}

/**
 * 카테고리 목록 조회 훅
 */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: scheduleApi.getCategories,
    staleTime: 1000 * 60 * 10, // 10분 캐시
  });
}
