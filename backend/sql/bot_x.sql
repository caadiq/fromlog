-- X 봇 테이블
CREATE TABLE IF NOT EXISTS bot_x (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  text_filters LONGTEXT,
  include_retweets TINYINT(1) DEFAULT 0,
  extract_youtube TINYINT(1) NOT NULL DEFAULT 0,
  -- extract_youtube가 켜졌을 때, YouTube 봇으로 등록된 채널 영상이면 추가에서 제외
  exclude_managed_channels TINYINT(1) NOT NULL DEFAULT 1,
  cron_interval INT DEFAULT 1,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
