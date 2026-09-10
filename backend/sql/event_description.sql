-- 행사에도 내용을 적을 수 있게
--
-- 대학 축제는 멤버별 참여가 갈린다 — 이번 축제엔 박지원이 뮤지컬 일정으로 빠지는 곳이 있는데
-- 그걸 적을 자리가 없었다. 기타·예능과 같은 자유 텍스트 한 칸.
ALTER TABLE schedule_event
  ADD COLUMN description TEXT NULL AFTER school_name;
