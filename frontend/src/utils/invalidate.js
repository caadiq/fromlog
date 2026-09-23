/**
 * 쓰기 직후 낡는 캐시를 지우는 자리.
 *
 * 종전에는 폼이 sessionStorage에 토스트를 넣고 목록으로 이동하면,
 * 목록이 그 토스트를 보고 ['adminSchedules']만 무효화하는 방식이었다(Schedules.jsx).
 * 두 가지가 샜다 —
 *   1) 토스트를 안 쓰는 경로(수집 큐에서 등록 후 '← 일정 관리')는 아무도 무효화하지 않았다.
 *   2) 토스트를 쓰더라도 공개 달력·일정 상세·검색 결과는 그대로 낡았다.
 *      특히 상세(['schedule', id])는 수정 폼의 초기값이기도 해서, 고친 직후 다시 열면
 *      수정 전 값이 채워지고 그대로 저장하면 방금 수정이 되돌아갔다.
 *
 * 무효화는 화면 이동이 아니라 **쓰기가 일어난 자리**에 붙어야 한다.
 */

/**
 * 일정을 만들거나 고치거나 지운 뒤.
 * 어느 카테고리든 이 한 줄이면 된다 — 접두사로 걸리므로 연·월이나 id를 몰라도 된다.
 */
export function invalidateSchedules(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['adminSchedules'] });      // 관리자 월별 목록
  queryClient.invalidateQueries({ queryKey: ['schedules'] });           // 공개 달력 · 다가오는 일정
  queryClient.invalidateQueries({ queryKey: ['schedule'] });            // 일정 상세 (= 수정 폼 초기값)
  queryClient.invalidateQueries({ queryKey: ['adminScheduleSearch'] }); // 관리자 검색 결과
}

/** 수집 큐를 건드린 뒤 (등록·무시 모두 대기 건수가 바뀐다) */
export function invalidatePending(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['pending-schedules'] });
  queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'mobile', 'pending-count'] });
}
