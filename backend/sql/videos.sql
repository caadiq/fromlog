-- 영상 아카이브 (영상 페이지 데이터원)
-- 일정과 분리: 봇이 매칭한 영상은 항상 여기 적재되고, 일정 생성은 봇별 add_to_schedule 토글로 결정.
CREATE TABLE IF NOT EXISTS videos (
  id INT(11) NOT NULL AUTO_INCREMENT,
  video_id VARCHAR(16) NOT NULL COMMENT 'YouTube 영상 ID',
  channel_id VARCHAR(64) NOT NULL,
  channel_name VARCHAR(200) DEFAULT NULL,
  title VARCHAR(500) NOT NULL,
  category ENUM('official', 'sp', 'variety', 'fancam') NOT NULL,
  video_type ENUM('video', 'shorts') NOT NULL DEFAULT 'video',
  published_at DATETIME NOT NULL COMMENT '유튜브 게시 시각 (KST)',
  members LONGTEXT DEFAULT NULL COMMENT '직캠 멤버 태그 (JSON 배열, 빈 배열=단체)' CHECK (json_valid(members)),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_videos_video_id (video_id),
  KEY idx_videos_cat_pub (category, published_at),
  KEY idx_videos_pub (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 봇별 영상 카테고리 + 일정 생성 토글
ALTER TABLE bot_youtube
  ADD COLUMN video_category ENUM('official', 'sp', 'variety', 'fancam') NOT NULL DEFAULT 'variety'
    COMMENT '이 채널 영상의 아카이브 분류',
  ADD COLUMN add_to_schedule TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1=일정도 생성(기존 동작), 0=영상 아카이브에만 적재';

-- 기존 봇 분류
UPDATE bot_youtube SET video_category = 'official' WHERE id = 1; -- fromis_9
UPDATE bot_youtube SET video_category = 'sp' WHERE id = 3;       -- 스프
-- 워크맨(5)·한화(6)·방판소녀들(7)은 기본값 variety
