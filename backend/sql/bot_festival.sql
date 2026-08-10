-- 대학 축제 크롤러 봇 설정
CREATE TABLE IF NOT EXISTS bot_festival (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '봇 이름',
  search_url VARCHAR(500) NOT NULL COMMENT '크롤링할 검색 페이지 URL',
  cron_interval INT NOT NULL DEFAULT 360 COMMENT '동기화 간격 (분)',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='대학 축제 크롤러 봇 설정';

-- 축제 크롤러 처리 로그 (memogipost 글 URL 중복 방지)
CREATE TABLE IF NOT EXISTS festival_crawl_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_url VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processed' COMMENT 'processed | no_event | error',
  result_count INT DEFAULT 0 COMMENT '추출된 행사 수',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_post_url (post_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='축제 크롤러 처리 로그';
