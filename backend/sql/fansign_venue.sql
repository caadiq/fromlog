-- 팬사인회에도 장소 (선택)
--
-- 비공개 팬사인회는 당첨자 개별 안내라 장소가 없지만,
-- 공개 팬사인회(예: 스타필드 수원 타워 아트리움)는 장소가 공지에 그대로 나온다.
-- 기타·행사와 같은 event_venues를 쓴다.
ALTER TABLE schedule_fansign
  ADD COLUMN venue_id INT NULL AFTER host,
  ADD KEY idx_fansign_venue (venue_id);
