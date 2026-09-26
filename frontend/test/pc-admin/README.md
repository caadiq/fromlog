# PC 관리자 브라우저 회귀 검사

기동한 개발 프론트엔드와 Playwright Chromium이 필요합니다. 백엔드 요청은 모두 대역 처리하고 외부 호스트 요청은 차단합니다. 실데이터 변경·실제 봇 실행 없이 UI와 요청 내용을 검사합니다.

```bash
export AUDIT_BASE_URL=https://dev.fromlog.caadiq.co.kr
# Playwright를 일반 node_modules 밖에 설치한 환경에서만 지정합니다.
export PLAYWRIGHT_MODULE=/path/to/playwright/package
export CHROMIUM_PATH=/path/to/chromium
export AUDIT_OUTPUT=/tmp/fromlog-pc-admin-audit

for suite in verify flows extended popovers navigation schedule-forms bot-forms sweep-after; do
  node "frontend/test/pc-admin/$suite.cjs" || exit 1
done
```

`PLAYWRIGHT_MODULE` 미지정 시 `require('playwright')`, `CHROMIUM_PATH` 미지정 시 Playwright 기본 Chromium을 사용합니다. 프로젝트 런타임 의존성에 Playwright를 추가하지 않습니다.

- `base.cjs`: 합성 데이터, 가짜 로그인 상태, 모든 API 응답·변경 요청 기록, 외부 네트워크 차단.
- `verify.cjs`: 영상 미리보기 경쟁, 저장/삭제, 모달, 목록 조회 실패·재시도.
- `flows.cjs`: 큐·봇·고정 링크·테마의 정상/실패/지연 흐름.
- `extended.cjs`: 상세 조회 실패, 편집 저장, 로그, 빈 상태, 동작 줄이기와 모바일 공유 확인창.
- `popovers.cjs`: 작은 화면의 선택기, 링크 토스트, 사전, 응원법, 분기 경계·CSS 확대.
- `navigation.cjs`: 일정 편집 복귀/새로고침의 필터 유지와 브라우저 뒤로가기.
- `schedule-forms.cjs`: 복합 일정 포함 수정 저장 및 생성 카테고리 8종 렌더링.
- `bot-forms.cjs`: YouTube/X/SCHEDULE 추가·수정 저장.
- `sweep-after.cjs`: 23개 화면을 3개 크기에서 검사하고 넘침/JS 예외를 JSON으로 기록.

실제 API·저장소·로그인 공급자·외부 미디어의 통합 검증을 대체하지 않습니다. 상세 결과와 한계는 [검증 기록](../../../docs/validation/05-pc-admin.md)에 있습니다.
