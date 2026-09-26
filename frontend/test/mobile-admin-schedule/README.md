# 모바일 관리자 일정 브라우저 검사

개발 프론트엔드와 Playwright Chromium이 필요합니다. 모든 API는 합성 응답으로 대체하고 외부 호스트는 차단합니다. 실제 일정/큐/봇 변경이나 Instagram·YouTube·Gemini 호출은 없습니다.

```bash
export AUDIT_BASE_URL=https://dev.fromlog.caadiq.co.kr
# Playwright와 Chromium이 일반 설치 경로 밖에 있는 경우 지정
export PLAYWRIGHT_MODULE=/path/to/playwright/package
export CHROMIUM_PATH=/path/to/chromium
export AUDIT_OUTPUT=/tmp/fromlog-mobile-admin-audit
for suite in flows extended access motion layout; do
  node "frontend/test/mobile-admin-schedule/$suite.cjs" || exit 1
done
```

- `base.cjs`: PC 공통 fixture 재사용, 날짜 고정, 합성 일정/큐와 요청 기록.
- `flows.cjs`: 목록·생성·수정·삭제·큐·장소·인스타·키보드 모의 검사 24개.
- `extended.cjs`: YouTube/X 조회 등록, 부분 실패, 첨부, 동작 줄이기, 스크롤 복원, 월 미정 9개.
- `access.cjs`: 모바일 로그인/로그아웃, 큐/상세 조회 실패 복구 3개.
- `motion.cjs`: 전환 중간 프레임, 반복 개폐, 회전과 큰 글자 3개.
- `layout.cjs`: 6개 화면 크기 × 5개 페이지/폼, 긴 제목·많은 일정, 넘침/위치와 캡처. 데이터와 등장 애니메이션이 준비된 뒤 검사합니다.

`flows`, `extended`는 `AUDIT_FILTER`에 이름 일부를 지정해 재현할 수 있습니다. `flows`의 `AUDIT_START`는 0부터 시작하는 검사 시작 위치입니다.

PC 공통 훅·팝업 회귀는 `../pc-admin/navigation.cjs`, `popovers.cjs`, `extended.cjs`로 확인합니다.

Chromium의 모바일 **화면 크기**와 `visualViewport` 모의 값으로 검사하며 실제 터치 디바이스·OS 키보드·Safari·Samsung Internet·Google OAuth를 대체하지 않습니다. [검증 기록](../../../docs/validation/06-mobile-admin-schedule.md)을 참고하세요.
