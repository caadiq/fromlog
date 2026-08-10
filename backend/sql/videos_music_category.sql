-- 영상 카테고리 'fancam' → 'music'(음방)
-- 음방 채널에서 직캠뿐 아니라 무대·안무·교차편집·시상식 영상까지 수집하므로
-- '직캠'보다 '음방'이 정확하다. 직캠은 그 안의 한 종류로 남는다.
ALTER TABLE videos
  MODIFY COLUMN category ENUM('official', 'sp', 'variety', 'fancam', 'music') NOT NULL;
UPDATE videos SET category = 'music' WHERE category = 'fancam';

ALTER TABLE bot_youtube
  MODIFY COLUMN video_category ENUM('official', 'sp', 'variety', 'fancam', 'music')
    NOT NULL DEFAULT 'variety';
UPDATE bot_youtube SET video_category = 'music' WHERE video_category = 'fancam';

-- 음방 채널에서 들어왔지만 '기타'로 분류된 무대·안무 영상을 음방으로 이동
UPDATE videos SET category = 'music'
WHERE category = 'variety'
  AND channel_id IN (
    'UCTQVIXvcHrR9jYoJ6qaBAow', -- M2
    'UCeLPm9yH_a_QH8n6445G-Ow', -- KBS Kpop
    'UCe52oeb7Xv_KaJsEzcKXJJg', -- MBCkpop
    'UCS_hnpJLQTvBkqALgapi_4g', -- SBSKPOP X INKIGAYO
    'UCM3jwNRfl5-W8VzgT6DsaEQ'  -- SBSKPOP ZOOM
  );

-- enum에서 사용하지 않는 fancam 제거
ALTER TABLE videos
  MODIFY COLUMN category ENUM('official', 'sp', 'variety', 'music') NOT NULL;
ALTER TABLE bot_youtube
  MODIFY COLUMN video_category ENUM('official', 'sp', 'variety', 'music')
    NOT NULL DEFAULT 'variety';
