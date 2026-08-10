-- YouTube 봇 테이블
CREATE TABLE IF NOT EXISTS bot_youtube (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_id VARCHAR(30) NOT NULL,
  channel_handle VARCHAR(50),
  channel_name VARCHAR(100) NOT NULL,
  banner_url VARCHAR(500),
  cron_interval INT DEFAULT NULL,
  enabled TINYINT(1) DEFAULT 1,

  -- 제목 필터 (선택, JSON 배열)
  title_filters JSON,

  -- 멤버 설정 (선택)
  default_member_ids JSON,
  extract_members_from_desc TINYINT(1) DEFAULT 0,
  extract_members_from_title TINYINT(1) DEFAULT 0,

  -- 다음 주 예정 일정 설정 (JSON)
  auto_schedule_config JSON,

  -- 주간 집중 폴링 설정 (JSON) — 있으면 cron_interval 대신 사용
  -- { dayOfWeek: 0~6, startTime: "HH:MM", intervalSeconds: int, durationMinutes: int }
  -- 새 영상 1개 발견 시 즉시 종료
  weekly_schedule_config JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_channel_id (channel_id)
);
