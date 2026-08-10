-- 유튜브 봇 쿼터 최적화: 필터로 거부된 영상 ID를 기록해 매 sync 재조회(videos.list 1 unit/영상)를 방지.
-- (쇼츠 제외/제목 필터로 거부된 영상은 schedule_youtube에 저장되지 않아 매번 "새 영상"으로 재조회되던 문제)
-- 봇 설정(제목 필터/쇼츠 제외) 변경 시 해당 채널 레코드를 삭제해 재평가되게 한다.
CREATE TABLE IF NOT EXISTS youtube_skipped_videos (
  video_id   VARCHAR(20)  NOT NULL PRIMARY KEY,
  channel_id VARCHAR(30)  NOT NULL,
  reason     VARCHAR(30)  NULL COMMENT 'title_filter | shorts | other',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel (channel_id)
);
