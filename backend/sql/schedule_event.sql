-- 행사 장소 (카카오맵 기반)
CREATE TABLE IF NOT EXISTS event_venues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(300),
  road_address VARCHAR(300),
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  kakao_id VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_kakao_id (kakao_id)
);

-- 행사 상세 (schedules와 1:1)
-- subtype: 'university' (학교 축제) 등 세부 타입 slug
-- school_name: 학교 행사의 경우 대학/학교명
-- venue_id: 장소 FK (선택)
-- post_urls: 인스타/공식 URL 배열 (JSON)
CREATE TABLE IF NOT EXISTS schedule_event (
  schedule_id INT PRIMARY KEY,
  subtype VARCHAR(30) NOT NULL,
  school_name VARCHAR(100),
  venue_id INT,
  post_urls JSON,
  poster_image_ids JSON,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id) REFERENCES event_venues(id) ON DELETE SET NULL,
  INDEX idx_subtype (subtype)
);
