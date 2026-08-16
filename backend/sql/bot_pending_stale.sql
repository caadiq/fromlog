-- 수집 큐: 최신 DC 글에서 사라진 항목 표시
-- DC "앞으로 일정" 글은 누적본이라 지난 일정만 지워지고 나머지는 그대로 옮겨진다.
-- 그래서 "아직 오지 않은 일정인데 최신 글에 없다" = 날짜가 바뀌었거나 취소된 것이다.
-- (실제 사례: "8/21 or 28 아는 형님"이 다음 날 "8/22"로 확정됐는데 옛 행이 큐에 남았다)
ALTER TABLE bot_pending_schedules
  ADD COLUMN stale_at TIMESTAMP NULL DEFAULT NULL
    COMMENT '최신 DC 글에서 사라진 시각(날짜 변경·취소 의심)' AFTER dup_hint;
