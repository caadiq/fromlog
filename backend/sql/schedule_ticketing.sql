-- 티켓팅 일정 상세 (선예매/일반예매 세트)
-- pair_schedule_id: 같은 세트의 상대 일정 (선예매 ↔ 일반예매 상호 참조)
-- series_id: 연결된 콘서트 시리즈 (팬미팅 등은 NULL)
CREATE TABLE IF NOT EXISTS schedule_ticketing (
  schedule_id INT(11) NOT NULL,
  stage ENUM('presale', 'general') NOT NULL,
  vendor VARCHAR(100) DEFAULT NULL COMMENT '예매처명 (멜론티켓 등)',
  ticket_url TEXT DEFAULT NULL COMMENT '예매 페이지 링크',
  purchase_limit VARCHAR(200) DEFAULT NULL COMMENT '매수 제한 (단계별 텍스트)',
  auth_start DATETIME DEFAULT NULL COMMENT '팬클럽 인증 시작 (선예매 조건)',
  auth_end DATETIME DEFAULT NULL COMMENT '팬클럽 인증 종료',
  auth_note VARCHAR(200) DEFAULT NULL COMMENT '인증 부가 설명 (멤버십명 등)',
  post_urls LONGTEXT DEFAULT NULL CHECK (json_valid(post_urls)),
  series_id INT(11) DEFAULT NULL,
  pair_schedule_id INT(11) DEFAULT NULL,
  PRIMARY KEY (schedule_id),
  KEY idx_ticketing_series (series_id),
  CONSTRAINT fk_ticketing_schedule FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE,
  CONSTRAINT fk_ticketing_series FOREIGN KEY (series_id) REFERENCES concert_series (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
