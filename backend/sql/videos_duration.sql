-- 영상 길이(초). 쇼츠 판별 때 이미 받아오던 값을 버리지 않고 저장한다.
-- NULL = 아직 백필되지 않음 (프론트는 값이 있을 때만 배지를 그린다)
ALTER TABLE videos ADD COLUMN duration INT NULL AFTER video_type;
