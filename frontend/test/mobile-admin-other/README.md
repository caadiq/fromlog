# 모바일 관리자 기타 브라우저 검사

개발 프론트와 Playwright Chromium이 필요합니다. PC 관리자 fixture를 재사용하며 모든 API를 합성 응답으로 대체하고 외부 호스트를 차단합니다. 실제 봇 실행·데이터 변경·외부 API 호출은 하지 않습니다.

```bash
export AUDIT_BASE_URL=https://dev.fromlog.caadiq.co.kr
export PLAYWRIGHT_MODULE=/path/to/playwright/package
export AUDIT_OUTPUT=/tmp/fromlog-mobile-other-audit
for suite in flows extended edges layout; do
  node "frontend/test/mobile-admin-other/$suite.cjs" || exit 1
done
```

- `recovery.cjs`: 복구 대기/재시도 KST 표시, 수동 정지 API 선택, 320·390·1440px 넘침 검사. `node frontend/test/mobile-admin-other/recovery.cjs`로 별도 실행.
- `base.cjs`: KST 날짜 고정, 목록/CRUD 응답 대역, 요청 기록, 실패·지연 주입. type/channel/행위자/날짜 필터의 서버 처리는 모의하지 않으며 요청 파라미터를 검사한다.
- `flows.cjs`: 19개. 영상 CRUD/필터/페이지, 봇 동작 및 3종 폼, 링크 CRUD/순서, 테마, 로그, 조회 실패/재시도.
- `extended.cjs`: 9개. 포커스/저장 잠금, 오류/할당량, 날짜, 새로고침, 애니메이션과 큰 글자.
- `edges.cjs`: 7개. FAB Back 순서, 필터 복원/저장소 장애, 긴 로그, 회전, 이미지 실패, YouTube 고급 필터.
- `layout.cjs`: 5개 크기 × 10개 목록/편집 상태. 넘침·다이얼로그 경계·캡처.

`AUDIT_FILTER`로 flows/extended/edges의 검사 이름 일부를 지정할 수 있습니다. `CHROMIUM_PATH`로 실행 파일을 지정할 수 있습니다. 공통 폼 회귀는 `../pc-admin/bot-forms.cjs`, 모바일 일정 전환 회귀는 `../mobile-admin-schedule/motion.cjs`로 검사합니다.

실제 터치 디바이스/OS 키보드/Safari 검사를 대신하지 않습니다. [전체 결과·제한](../../../docs/validation/11-mobile-admin-other.md)을 참고하세요.
