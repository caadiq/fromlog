-- Relevant production table definitions; no production data.
SET FOREIGN_KEY_CHECKS=0;
CREATE TABLE `youtube_bot_processed` (
  `channel_id` varchar(64) NOT NULL,
  `video_id` varchar(32) NOT NULL,
  `is_target` tinyint(4) NOT NULL DEFAULT 0,
  `video_date` date NOT NULL,
  PRIMARY KEY (`channel_id`,`video_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `bot_youtube` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `channel_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_handle` varchar(50) DEFAULT NULL,
  `channel_name` varchar(100) NOT NULL,
  `banner_url` varchar(500) DEFAULT NULL,
  `cron_interval` int(11) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT 1,
  `title_filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`title_filters`)),
  `exclude_shorts` tinyint(1) NOT NULL DEFAULT 0,
  `archive_shorts` tinyint(1) NOT NULL DEFAULT 1,
  `auto_schedule_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`auto_schedule_config`)),
  `weekly_schedule_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`weekly_schedule_config`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `video_category` enum('official','sp','variety','music') NOT NULL DEFAULT 'variety',
  `add_to_schedule` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=일정도 생성(기존 동작), 0=영상 아카이브에만 적재',
  `description_filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`description_filters`)),
  `filter_mode` varchar(16) NOT NULL DEFAULT 'legacy',
  `min_duration_seconds` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_channel_id` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
CREATE TABLE `album_tracks` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '고유 ID',
  `album_id` int(11) NOT NULL COMMENT '앨범 ID (FK)',
  `track_number` int(11) NOT NULL COMMENT '트랙 번호',
  `title` varchar(200) NOT NULL COMMENT '곡 제목',
  `is_title_track` tinyint(1) DEFAULT 0 COMMENT '타이틀곡 여부',
  `duration` varchar(10) DEFAULT NULL COMMENT '재생 시간',
  `lyrics` text DEFAULT NULL COMMENT '가사',
  `description` text DEFAULT NULL COMMENT '곡 설명',
  `lyricist` varchar(500) DEFAULT NULL COMMENT '작사',
  `composer` varchar(500) DEFAULT NULL COMMENT '작곡',
  `arranger` varchar(500) DEFAULT NULL COMMENT '편곡',
  `video_url` varchar(255) DEFAULT NULL,
  `video_type` enum('music_video','special') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_album_track` (`album_id`,`track_number`),
  CONSTRAINT `album_tracks_1` FOREIGN KEY (`album_id`) REFERENCES `albums` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci COMMENT='앨범 수록곡 정보';
CREATE TABLE `schedule_event` (
  `schedule_id` int(11) NOT NULL,
  `subtype` varchar(30) NOT NULL,
  `school_name` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `venue_id` int(11) DEFAULT NULL,
  `post_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`post_urls`)),
  `poster_image_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`poster_image_ids`)),
  PRIMARY KEY (`schedule_id`),
  KEY `venue_id` (`venue_id`),
  KEY `idx_subtype` (`subtype`),
  CONSTRAINT `schedule_event_1` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `schedule_event_2` FOREIGN KEY (`venue_id`) REFERENCES `event_venues` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
CREATE TABLE `schedule_youtube` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '유튜브 일정 ID',
  `schedule_id` int(11) NOT NULL COMMENT '일정 ID (FK: schedules_tmp.id)',
  `video_id` varchar(20) DEFAULT NULL,
  `video_type` enum('video','shorts') NOT NULL DEFAULT 'video' COMMENT '영상 유형',
  `channel_id` varchar(30) DEFAULT NULL COMMENT '유튜브 채널 ID',
  `channel_name` varchar(100) DEFAULT NULL COMMENT '채널 이름',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schedule` (`schedule_id`),
  UNIQUE KEY `uk_video` (`video_id`),
  CONSTRAINT `schedule_youtube_fk_schedule_youtube_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='유튜브 일정 확장 정보';
CREATE TABLE `logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `actor` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `category` varchar(30) NOT NULL,
  `target_type` varchar(50) DEFAULT NULL,
  `target_id` int(10) unsigned DEFAULT NULL,
  `summary` varchar(500) NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_category` (`category`),
  KEY `idx_actor` (`actor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
CREATE TABLE `youtube_skipped_videos` (
  `video_id` varchar(20) NOT NULL,
  `channel_id` varchar(30) NOT NULL,
  `reason` varchar(30) DEFAULT NULL COMMENT 'title_filter | shorts | other',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`video_id`),
  KEY `idx_channel` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
CREATE TABLE `videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_id` varchar(16) NOT NULL COMMENT 'YouTube 영상 ID',
  `channel_id` varchar(64) NOT NULL,
  `channel_name` varchar(200) DEFAULT NULL,
  `title` varchar(500) NOT NULL,
  `category` enum('official','sp','variety','music') NOT NULL,
  `video_type` enum('video','shorts') NOT NULL DEFAULT 'video',
  `duration` int(11) DEFAULT NULL,
  `published_at` datetime NOT NULL COMMENT '유튜브 게시 시각 (KST)',
  `members` longtext DEFAULT NULL COMMENT '직캠 멤버 태그 (JSON 배열, 빈 배열=단체)' CHECK (json_valid(`members`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_videos_video_id` (`video_id`),
  KEY `idx_videos_cat_pub` (`category`,`published_at`),
  KEY `idx_videos_pub` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `schedule_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `color` varchar(20) NOT NULL DEFAULT 'blue',
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
CREATE TABLE `schedule_x` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'X 일정 ID',
  `schedule_id` int(11) NOT NULL COMMENT '일정 ID (FK: schedules_tmp.id)',
  `post_id` varchar(30) NOT NULL COMMENT 'X 게시글 ID',
  `username` varchar(50) DEFAULT NULL,
  `content` text DEFAULT NULL COMMENT '게시글 전문',
  `image_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '이미지 URL 배열' CHECK (json_valid(`image_urls`)),
  `video_thumbnails` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`video_thumbnails`)),
  `card_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`card_data`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schedule` (`schedule_id`),
  KEY `idx_post` (`post_id`),
  CONSTRAINT `schedule_x_fk_schedule_x_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='X 일정 확장 정보';
CREATE TABLE `schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '일정 ID',
  `category_id` int(11) DEFAULT NULL COMMENT '카테고리 ID (FK: schedule_categories.id)',
  `title` varchar(500) NOT NULL COMMENT '일정 제목',
  `date` date NOT NULL COMMENT '일정 날짜',
  `date_precision` enum('day','month') NOT NULL DEFAULT 'day',
  `time` time DEFAULT NULL COMMENT '일정 시간',
  `is_temp` tinyint(1) NOT NULL DEFAULT 0 COMMENT '임시 일정 여부 (0: 확정, 1: 예정)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `schedules_fk_schedules_tmp_category` FOREIGN KEY (`category_id`) REFERENCES `schedule_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='일정 기본 테이블';
CREATE TABLE `bot_x` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `text_filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`text_filters`)),
  `include_retweets` tinyint(1) DEFAULT 0,
  `extract_youtube` tinyint(1) NOT NULL DEFAULT 0,
  `exclude_managed_channels` tinyint(1) NOT NULL DEFAULT 1,
  `cron_interval` int(11) DEFAULT 1,
  `enabled` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS=1;
