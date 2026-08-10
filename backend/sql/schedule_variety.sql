-- 예능 일정 상세 테이블
CREATE TABLE IF NOT EXISTS schedule_variety (
  schedule_id INT NOT NULL,
  broadcaster VARCHAR(100) NOT NULL COMMENT '방송사/플랫폼 (KBS, MBC, 유튜브, 티빙 등)',
  replay_url VARCHAR(500) DEFAULT NULL COMMENT '다시보기 링크',
  thumbnail_id INT DEFAULT NULL COMMENT '썸네일 이미지 ID (images 테이블 참조)',
  PRIMARY KEY (schedule_id),
  CONSTRAINT fk_variety_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='예능 일정 상세';

-- 예능 카테고리 추가
-- INSERT INTO schedule_categories (name, color, sort_order) VALUES ('예능', '#22c55e', 5);
