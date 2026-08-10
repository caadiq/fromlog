-- YouTube 봇 시드 데이터
-- channel_handle은 봇 추가 시 YouTube API로 조회하여 저장

INSERT INTO bot_youtube (channel_id, channel_name, cron_interval, enabled) VALUES
  ('UCXbRURMKT3H_w8dT-DWLIxA', 'fromis_9', 2, 1),
  ('UCtfyAiqf095_0_ux8ruwGfA', 'MUSINSA TV', 2, 1),
  ('UCeUJ8B3krxw8zuDi19AlhaA', '스프 : 스튜디오 프로미스나인', 2, 1)
ON DUPLICATE KEY UPDATE channel_name = VALUES(channel_name);

-- 스프 : 스튜디오 프로미스나인 - 예정 일정 설정
UPDATE bot_youtube
SET auto_schedule_config = '{"dayOfWeek":4,"time":"18:00:00","titleTemplate":"{channelName} {episode}화","deadlineDayOfWeek":5,"excludeShorts":true}'
WHERE channel_id = 'UCeUJ8B3krxw8zuDi19AlhaA';

-- MUSINSA TV - 필터/멤버 설정
UPDATE bot_youtube
SET title_filters = '["성수기"]',
    default_member_ids = '[7]',
    extract_members_from_desc = 1
WHERE channel_id = 'UCtfyAiqf095_0_ux8ruwGfA';
