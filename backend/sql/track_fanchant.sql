-- 곡별 응원법 (공식 응원법 영상 + 줄·구간 타임스탬프)
--
-- lines는 JSON 배열. 줄마다 시작 시간(t)을 갖고, 줄 안의 응원법 구간은 parts에 담는다.
--   [
--     { "t": 4.20, "parts": [ { "text": "프로미스나인 송하영 …", "type": "call", "t": 4.20 } ] },
--     { "t": 12.10, "parts": [ { "text": "말해봐 뭐든 say " },
--                              { "text": "(say)", "type": "call", "t": 13.40 } ] },
--     { "gap": true },
--     { "t": 15.00, "parts": [ { "text": "붉게 타는 태양의 끝에" } ] }
--   ]
-- type 없는 part는 일반 가사. type은 'call'(이어서 외치기) | 'sing'(같이 부르기).
-- t는 초 단위 소수 2자리. 아직 안 찍은 지점은 null.
--
-- 색은 앨범 커버에서 자동 추출하되, 단색 커버처럼 두 색이 안 나오는 경우를 위해
-- 곡별 수동 지정(color_call / color_sing)을 둔다. NULL이면 자동값을 쓴다.
CREATE TABLE IF NOT EXISTS track_fanchant (
  track_id    INT          NOT NULL COMMENT '곡 ID (FK: album_tracks.id)',
  video_id    VARCHAR(20)  NOT NULL COMMENT '공식 응원법 영상 YouTube ID',
  color_call  VARCHAR(7)   NULL     COMMENT '이어서 외치기 색 (#RRGGBB, NULL이면 자동)',
  color_sing  VARCHAR(7)   NULL     COMMENT '같이 부르기 색 (#RRGGBB, NULL이면 자동)',
  -- 'lines'는 MariaDB 예약어(LOAD DATA ... LINES)라 컬럼명으로 쓰지 않는다
  lines_json  LONGTEXT     NOT NULL COMMENT '줄·구간 JSON',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (track_id),
  CONSTRAINT fk_track_fanchant_track FOREIGN KEY (track_id)
    REFERENCES album_tracks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='곡별 응원법';
