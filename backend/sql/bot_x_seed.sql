-- X 봇 초기 데이터
-- 기존 config/bots.js에 하드코딩된 X 봇을 DB로 마이그레이션

INSERT INTO bot_x (username, display_name, cron_interval, enabled)
VALUES ('realfromis_9', 'fromis_9', 1, 1)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
