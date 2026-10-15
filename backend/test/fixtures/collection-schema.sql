-- Additional production table definitions, no production data.
SET FOREIGN_KEY_CHECKS=0;
CREATE TABLE `members` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '고유 ID',
  `name` varchar(50) NOT NULL COMMENT '멤버 이름 (한글)',
  `name_en` varchar(100) DEFAULT NULL,
  `birth_date` date DEFAULT NULL COMMENT '생년월일',
  `instagram` varchar(200) DEFAULT NULL COMMENT '인스타그램 URL',
  `image_id` int(11) DEFAULT NULL,
  `is_former` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='프로미스나인 멤버 정보';
CREATE TABLE `bot_pending_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source` varchar(20) NOT NULL DEFAULT 'dc',
  `source_ref` varchar(100) DEFAULT NULL,
  `category_name` varchar(30) NOT NULL,
  `title` varchar(500) NOT NULL,
  `date` date DEFAULT NULL,
  `time` time DEFAULT NULL,
  `members` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`members`)),
  `venue_name` varchar(200) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `raw` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw`)),
  `dup_hint` varchar(255) DEFAULT NULL COMMENT '기존 일정과 겹칠 수 있음 — 겹치는 일정 요약',
  `stale_at` timestamp NULL DEFAULT NULL COMMENT '최신 DC 글에서 사라진 시각(날짜 변경·취소 의심)',
  `dedup_key` varchar(255) NOT NULL,
  `status` enum('pending','registered','dismissed') NOT NULL DEFAULT 'pending',
  `created_schedule_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_dedup` (`dedup_key`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
CREATE TABLE `festival_crawl_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_url` varchar(500) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'processed' COMMENT 'processed | no_event | error',
  `result_count` int(11) DEFAULT 0 COMMENT '추출된 행사 수',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_url` (`post_url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='축제 크롤러 처리 로그';
SET FOREIGN_KEY_CHECKS=1;
