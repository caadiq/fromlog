-- 응원법 초안/공개 분리
--
-- 종전 공개 조건은 "시각이 하나라도 찍혔는가"였다. 그래서 작업 중에 저장하면
-- 반쯤 찍힌 응원법이 곧바로 팬에게 보였다(중간 저장 = 공개).
-- 공개 여부를 따로 두어, 다 되면 켜서 내보내게 한다.
ALTER TABLE track_fanchant
  ADD COLUMN published TINYINT(1) NOT NULL DEFAULT 0 AFTER video_id;

-- 이미 공개돼 있던 것(영상 + 싱크 보유)은 그대로 공개 유지
UPDATE track_fanchant
   SET published = 1
 WHERE video_id IS NOT NULL AND video_id <> '' AND lines_json REGEXP '"t":[0-9]';
