-- 팬사인회: 장소 → 주최(음반점) 전환
-- 장소는 당첨자에게 개별 안내되어 사이트에 표기할 정보가 아니므로 제거하고,
-- 실질적으로 유용한 주최(비트로드·후즈팬스토어 등)를 넣는다.
-- format: 대부분의 행사가 "대면 종료 후 영상통화" 형태라 both를 추가.
ALTER TABLE schedule_fansign
  DROP FOREIGN KEY fk_fansign_venue;

ALTER TABLE schedule_fansign
  DROP INDEX idx_venue,
  DROP COLUMN venue_id,
  ADD COLUMN host VARCHAR(100) DEFAULT NULL COMMENT '주최 (음반점 등)',
  MODIFY COLUMN format ENUM('offline', 'online', 'both') NOT NULL DEFAULT 'offline'
    COMMENT 'offline=대면, online=영상통화, both=대면+영상통화';
