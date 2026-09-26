# PC 공개 영상·일정 브라우저 검증

개발 사이트의 실제 프론트엔드를 사용한다. `verify.cjs`, `extended.cjs`는 공개 API 응답을 합성하며 GET 외 요청을 허용하지 않는다. 외부 이미지는 실패 조건으로 검사하고 포스터는 테스트 SVG를 사용한다. 시스템 날짜는 2026-09-26으로 시작해 정상 속도로 흐르게 한다.

```bash
export PLAYWRIGHT_MODULE=/home/caadiq/.cache/ms-playwright-go/1.50.1/package
export CHROMIUM_PATH=/home/caadiq/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell
export AUDIT_BASE_URL=https://dev.fromlog.caadiq.co.kr
export AUDIT_OUTPUT=/tmp/fromlog-pc-public-media
/home/caadiq/.cache/ms-playwright-go/1.50.1/node frontend/test/pc-public-media/verify.cjs
/home/caadiq/.cache/ms-playwright-go/1.50.1/node frontend/test/pc-public-media/extended.cjs
```

`live-smoke.cjs`는 실제 공개 데이터를 읽어 화면을 캡처한다. GET 외 요청과 방문 통계 수집을 차단한다. `워크돌` 검색 결과가 있는 현재 개발 데이터에 의존한다. 영상의 재생 자체를 보증하는 테스트는 아니다.

```bash
/home/caadiq/.cache/ms-playwright-go/1.50.1/node frontend/test/pc-public-media/live-smoke.cjs
docker exec fromlog-frontend npm run build
```

검증 범위/한계: [8번 기록](../../../docs/validation/08-pc-public-video-schedule.md).
