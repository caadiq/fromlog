-- 팬사인회 상세 (schedules와 1:1)
-- format: 'offline'(대면) | 'online'(영통). 대면이면 venue_id로 장소 연결, 영통이면 venue_id NULL
CREATE TABLE IF NOT EXISTS schedule_fansign (
  schedule_id INT NOT NULL PRIMARY KEY,
  format ENUM('offline', 'online') NOT NULL DEFAULT 'offline',
  venue_id INT DEFAULT NULL,
  post_urls JSON DEFAULT NULL, -- 출처 링크 배열 (위버스 공지·판매처 등)
  KEY idx_venue (venue_id),
  CONSTRAINT fk_fansign_schedule FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE,
  CONSTRAINT fk_fansign_venue FOREIGN KEY (venue_id) REFERENCES event_venues (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
