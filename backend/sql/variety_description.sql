-- 예능에도 내용을 적을 수 있게 (누가 출연하는지 등)
-- 기타(schedule_etc.description)와 같은 자유 텍스트 한 칸
ALTER TABLE schedule_variety
  ADD COLUMN description TEXT NULL AFTER broadcaster;
