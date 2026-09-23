ALTER TABLE bot_youtube
  ADD COLUMN IF NOT EXISTS description_filters JSON NULL,
  ADD COLUMN IF NOT EXISTS filter_mode VARCHAR(16) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS min_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS youtube_bot_processed (
  channel_id VARCHAR(64) NOT NULL,
  video_id VARCHAR(32) NOT NULL,
  is_target TINYINT NOT NULL DEFAULT 0,
  video_date DATE NOT NULL,
  PRIMARY KEY (channel_id, video_id)
);
