-- Durable extraction checkpoints and a queue-notification outbox. No existing rows are changed.
CREATE TABLE IF NOT EXISTS bot_collection_runs (
  id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  post_url VARCHAR(500) NOT NULL,
  body_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  extracted_items JSON NOT NULL,
  added_count INT UNSIGNED NOT NULL DEFAULT 0,
  queued_at DATETIME NULL,
  notification_pending TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_post (post_url),
  KEY idx_notification (notification_pending),
  KEY idx_unqueued (queued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
