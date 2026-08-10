-- 채널별 '쇼츠를 아카이브에 담을지' 옵션
-- 기존 exclude_shorts는 "일정에서만 제외"라 영상 페이지에는 그대로 쌓인다.
-- 풀무원처럼 쇼츠 대부분이 게스트만 나오는 클립이라 제목·설명으로 구분할 수 없는
-- 채널은 아카이브에서도 빼야 한다.
ALTER TABLE bot_youtube
  ADD COLUMN archive_shorts TINYINT(1) NOT NULL DEFAULT 1 AFTER exclude_shorts;
