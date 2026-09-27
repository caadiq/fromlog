# 모바일 공개 콘텐츠 검증

15번 결과: [검증 문서](../../../docs/validation/15-mobile-public-content.md).

Playwright 1.61.1 및 Chromium/Firefox/WebKit이 있는 컨테이너에서 실행한다. 호스트 Node는 사용하지 않는다. 프로젝트를 `/work`에 마운트한다. 아래 경로는 저장소 루트 기준이다.

```sh
node frontend/test/mobile-public-content/verify.cjs
node frontend/test/mobile-public-content/layout.cjs
node frontend/test/mobile-public-content/edges.cjs
node frontend/test/mobile-public-content/extra.cjs
node frontend/test/mobile-public-content/navigation.cjs
node frontend/test/mobile-public-content/final-check.cjs
node frontend/test/mobile-public-content/live.cjs
```

- `PLAYWRIGHT_MODULE`: Playwright 패키지 경로(선택), `NODE_PATH`: 모듈 탐색 경로.
- `AUDIT_BASE_URL`: 기본 `https://dev.fromlog.caadiq.co.kr`, `AUDIT_OUTPUT`: 캡처/측정 저장 경로.
- `verify`: 9개 실패/재시도 경로, 빈 목록/404, 홈 연결, 소개/사진의 중첩 Back, 가사, 원본 저장과 실패, 느린 곡 조회.
- `layout`: 9개 경로 × 5개 화면(320×568, 390×844, 844×390, 800×1100, 1099×768), 긴 문자열, 소개창, 1100px 분기.
- `edges`: 3개 엔진에서 제한된 동작 줄이기/포커스/중첩 Back 흐름. Chromium에서 600장 가상화·회전·터치 이벤트·실제 짧은 WebM 재생/슬라이드 이탈·중간 애니메이션 프레임 확인.
- `extra`: YouTube API 모의 플레이어 재시도/탐색/해제, 가로 화면 영상 비율, 홈 부분 실패/0, 404, 다운로드 중복 방지와 닫기 취소, CSS 1.4배 확대에서 닫기 도달.
- `navigation`: 하단 메뉴/선택, 앞뒤 이동/새로고침, SNS 링크·터치 영역, 사진 필터, 긴 정보 시트 스크롤, 낮은 소개창, 마지막 응원법 가사 도달.
- `final-check`: 멤버 상세·PC X 실제 href·소개창 캡처.
- `live`: 실제 공개 GET/HEAD만 허용, 앨범 17개 및 활동 멤버 5명 직접 진입, 원본 WebP 다운로드, 실제 사진/곡/응원법 로드. DB 쓰기·봇·AI 실행 없음.

모의 테스트는 브라우저에서 API 응답을 가로채며 외부 요청을 차단한다. 실기기 주소창·노치·다운로드 UI, 전체 음원 재생/정밀 싱크, 실제 핀치·멀티터치까지 검증한 것은 아니다. `edges`의 동영상은 기존 PC 검증용 2초 무음 파일을 재사용한다.

공통 회귀:

```sh
node frontend/test/mobile-public-media/extended.cjs
node frontend/test/pc-public-content/verify.cjs
```
