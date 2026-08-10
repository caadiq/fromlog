-- 동적 테마 컬러 기능
-- 1) 앨범별 커버에서 추출한 대표색 (정규화된 primary hex)
ALTER TABLE albums
  ADD COLUMN theme_color VARCHAR(7) NULL AFTER cover_thumb_url;

-- 2) 앱 전역 설정 (key-value) — 테마 모드/수동색 등
CREATE TABLE IF NOT EXISTS app_settings (
  `key`        VARCHAR(64)  NOT NULL PRIMARY KEY,
  `value`      TEXT         NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 테마 기본값: 자동 모드
INSERT INTO app_settings (`key`, `value`) VALUES
  ('theme_mode', 'auto'),
  ('theme_manual_color', NULL)
ON DUPLICATE KEY UPDATE `key` = `key`;
