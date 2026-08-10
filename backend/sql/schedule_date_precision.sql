-- 일정 날짜 정밀도
-- 'day'   : 정확한 날짜 (기존 일정 전부, 기본값)
-- 'month' : 월만 확정, 일자 미정 (date는 해당 월 1일로 저장)
-- 날짜가 확정되면 일정 수정에서 정확한 date 입력 + date_precision='day'로 변경
ALTER TABLE schedules
  ADD COLUMN date_precision ENUM('day', 'month') NOT NULL DEFAULT 'day' AFTER date;
