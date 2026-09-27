# 웹·앱 성능 검증

실행 환경: Node 컨테이너, Playwright Chromium, **Vite production build**를 제공하는 로컬 서버. API는 기존 `pc-public-media/base.cjs` 합성 응답으로 대체하고 외부 이미지는 차단한다. 실제 데이터 변경·봇 실행은 없다.

## 재현

1. 변경 전후 `frontend/dist`를 각각 별도 폴더에 보관한다.
2. `BUILD_ROOT=/absolute/path/to/dist PORT=18090 node frontend/test/performance/server.cjs`로 기동한다. 로컬 127.0.0.1에만 바인딩하며 검사 전용 서버다.
3. 아래 환경에서 스크립트를 실행한다. 로딩 비교는 다른 브라우저/빌드 작업과 겹치지 않게 실행한다.

```bash
export AUDIT_BASE_URL=http://127.0.0.1:18090
export PLAYWRIGHT_MODULE=/path/to/playwright
export AUDIT_OUTPUT=/tmp/fromlog-performance/results/performance
export RESULT_FILE=/tmp/fromlog-performance/results/loading.json
node frontend/test/performance/loading.cjs
node frontend/test/performance/verify.cjs
node frontend/test/performance/video-scroll.cjs
```

- `loading.cjs`: PC/모바일 × 홈/영상/일정 × 3회. gzip 전송, 브라우저 캐시 비활성화. PC 20ms/2MB/s/CPU 1배, 모바일 100ms/200KB/s/CPU 4배 감속. JS 전송량, LCP, 긴 작업의 50ms 초과분 합계 기록. 마지막 값은 Lighthouse 공식 TBT가 아니다.
- `verify.cjs`: 검색 2,000건 가상 목록, PC·모바일 20회 왕복 후 GC/DOM/이벤트/힙 비교, 청크 실패·재시도·화면 폭 전환·오프라인 복귀, 홈 사진 요청 수·11회 전환·동작 줄이기.
- `video-scroll.cjs`: 영상 600개를 24개씩 25회 실제 스크롤로 누적. 요청 중복, 목록 유지, 위로 복귀 후 필터 조작, 메모리 기록. 웹 영상 목록은 가상 목록이 아니므로 DOM이 데이터 수에 비례한다.
- Flutter: `cd app && flutter test test/performance_validation_test.dart`. 같은 달 600개 합성 데이터로 일반/쇼츠 카드 마운트 수와 스크롤·종료를 검사한다. 대량 JSON의 별도 isolate를 테스트 가상 시계 밖에서 기다리는 문제를 피하려고 테스트에서만 SyncTransformer를 사용한다.

외부 미디어·폰트 차단과 합성 API, 로컬 서버 조건이므로 실제 사용자 Core Web Vitals나 Android 프레임 성능을 대신하지 않는다. 결과와 한계는 [13번 기록](../../../docs/validation/13-performance.md)에 있다.
