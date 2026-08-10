-- FCM 기기 토큰 (푸시 알림 대상)
-- topics: 구독 중인 알림 종류 (JSON 배열). 'ops'=운영 알림(세션 만료 등)
-- 향후 'comeback', 'schedule' 등을 추가해 팬 알림으로 확장.
CREATE TABLE IF NOT EXISTS device_tokens (
  id INT(11) NOT NULL AUTO_INCREMENT,
  token VARCHAR(255) NOT NULL COMMENT 'FCM 등록 토큰',
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  topics LONGTEXT DEFAULT NULL CHECK (json_valid(topics)),
  is_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=운영 알림 수신 기기',
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_device_token (token),
  KEY idx_device_admin (is_admin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
