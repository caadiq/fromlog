# 07. 입력·외부 콘텐츠·비밀값

- 상태: 완료 — 소스·자동 회귀 검증 완료, Android 실제 네트워크 검사는 10번 후속
- 검증일: 2026-09-26
- 기준 버전: `18620809` 이후 작업 트리
- 환경: 공유 Fastify 백엔드, 개발 Vite/Chromium, 외부 네트워크 없는 별도 MariaDB 11, Flutter 테스트·Android 릴리스 빌드
- 사용자 확인: APK는 명우님만 사용하는 개인용. 앱 수신자를 일반 공개 사용자로 가정하지 않음.
- 범위: API 입력·업로드·외부 링크 가져오기·문자열 표시·앱 다운로드·현재 배포물과 응답의 비밀값 경로. 저장소 전체·Git 이력·인프라 전체 점검으로 확대 해석하지 않음.

## 확인 결과

| 항목 | 결과·근거 |
| --- | --- |
| API·업로드 | 검토한 SQL은 매개변수 바인딩 사용. 관리자 업로드는 인증 후 처리하고 이미지는 sharp를 통해 WebP로 재인코딩. 추천 검색은 길이 255자·결과 1~20개로 제한 보완. |
| Instagram | 정확한 게시물 호스트/경로, CDN 호스트, 리다이렉트 거부, 스트리밍 크기·시간·픽셀 제한 확인. 기존 회귀 통과. |
| X OG 보강 | 목적지 검증 없는 리다이렉트 및 헤더 이후 타임아웃 해제 문제를 확인하고 수정. |
| 외부 표시 | React의 X 본문·검색 강조는 텍스트 노드. Kakao 장소명은 DOM `textContent`, 앱 videoId는 JSON 문자열로 직렬화하고 `<`를 이스케이프하도록 보완. 두 보간 지점은 확정적인 비관리자 공격 경로가 입증되지 않아 별도 취약점으로 과장하지 않음. |
| 앱 다운로드 | `ignoreSsl:true`를 제거하여 인증서·호스트 검증을 기본값으로 복구. OTA는 별도 경로이고 이번 문제로 OTA 변조를 주장하지 않음. |
| 비밀값 | 현재 추적 파일에 `.env`·`secrets.dart`·서명 키 없음. 설정된 서버 비밀값 11개의 정확 일치 검사: 클라이언트/정적 파일 375개, 재빌드 dist, 공개 응답, 최근 백엔드 stdout/stderr에서 일치 없음. 원문 비밀값은 출력·문서화하지 않음. |
| 푸시 등록 키 | 개인용 앱이므로 현재 공개 APK 유출로 분류하지 않음. 키·등록 기기·푸시 동작은 변경하지 않음. 공개 배포로 바뀌면 관리자 푸시 등록 권한을 앱 공통 키에서 분리해야 함. |
| 1번 인증 회귀 | 인증·프록시 테스트와 102개 보호 라우트 검사 재실행 통과. |

## 발견 문제와 수정

1. **중간 — 외부 OG 링크의 서버 내부 요청**: X 봇에 수집되는 링크 응답을 통제할 수 있어야 하는 조건부 경로. 일반 익명 API 호출로 직접 실행하는 경로는 아님. `publicFetch.js`에서 HTTP(S)·기본 포트·사용자정보 없는 URL만 허용하고, DNS의 모든 결과를 검사한 뒤 확인한 IP로 연결을 고정한다. 각 리다이렉트도 다시 검사한다. 내부 HTTP GET 가능성은 확인했지만 내부 서비스 공격·임의 본문 전체 유출은 실행하지 않았다.
2. **중간 — OG 응답으로 수집 작업 점유**: 헤더 수신 후에도 본문이 끝나지 않으면 수집 슬롯을 계속 보유했다. DNS→리다이렉트→본문 전체에 8초 제한, 본문 2MiB(TikTok oEmbed 256KiB), 리다이렉트 4회 제한을 적용했다. 압축은 요청하지 않으며 예외적으로 압축된 응답은 거부한다. 실패 시 기존처럼 카드 보강만 생략하며 수집 자원은 반환한다.
3. **낮음 — 앱 미디어 TLS 검증 우회**: 개인 기기의 네트워크를 가로챌 수 있는 공격자가 다운로드 미디어를 바꿀 수 있었다. 인증서 검증을 켜는 설정과 네이티브 채널 전달값을 검증했다. 실제 Android에서 잘못된 인증서를 제공하는 네트워크 재현은 하지 않았다.

IPv4 사설/루프백/링크로컬/공유/문서·예약 주소, IPv6 로컬/매핑/NAT64/6to4/특수 주소를 거부한다. 일반 공개 IPv6만 허용하는 보수적인 정책이므로 특수 네트워크의 OG 카드가 생략될 수 있다. HTTP 원문 링크는 호환성을 위해 허용하며 외부 문구를 신뢰된 코드로 승격하지 않는다.

## 실행한 검증

| 검사 | 결과 |
| --- | --- |
| 백엔드 단위·라우트 회귀 | **95개 통과**. 아래 명령에 새 외부 요청 15개·추천 입력 1개 포함. |
| 별도 MariaDB 봇 통합 | **12개 통과**(상위 1 + 시나리오 11). X/YouTube 선후·동시 수집, 재시도, 예정·회차·중복 처리. 외부 응답 대체, 운영 DB 미접속. |
| 외부 요청 공격 입력 | 내부 IP 표기 변형, 혼합 DNS, 같은 호스트의 DNS 변경, 내부 주소 리다이렉트, 반복 리다이렉트, 큰 본문, 끝나지 않는 본문·늦은 DNS 거부. 실제 로컬 HTTP 스트림 취소와 공유 슬롯 반환 확인. |
| 정상 외부 조회 | example.com HTTPS 수신과 기존 YouTube 영상 `Am4EJN0uF3Q`의 제목·이미지 OG 수집 성공. Google/Gemini 유료 API 호출 없음. |
| Flutter | 다운로드 네이티브 초기화값, YouTube 외부 열기, JS 문자열 처리 **8개 통과**. 변경 4개 파일 분석 오류·안내 0개. |
| Flutter 전체 분석 | 종료 1: 기존 변경 밖 파일의 info 10건(const/null-aware/deprecated scale), 오류·경고 없음. 이번 작업으로 해당 파일을 변경하지 않음. |
| 브라우저 | PC 1440×900·모바일 390×844에서 정상 장소명 및 HTML 형태 장소명이 자식 요소 없는 텍스트로 표시됨. 지도 SDK는 모의 구현, 실제 SDK 계약은 공식 문서로 확인. |
| 빌드 | 프론트엔드 production 빌드 및 Android arm64 릴리스 빌드 성공. Vite의 기존 chunk 크기·Browserslist 안내는 유지. |
| 운영/개발 읽기 검사 | 개발 `/.env` 403, 운영 `/.env`는 SPA HTML(200)이고 비밀값 없음. 공개 봇·API 문서 응답도 일치 없음. 잘못된 추천 개수 400, 정상 월별 일정 200. |

백엔드 실행:

```sh
docker exec fromlog-backend node --test \
  test/public-fetch.test.js test/suggestions-input.test.js \
  test/instagram-posters.test.js test/x-scraper.test.js \
  test/youtube-api.test.js test/youtube-policy.test.js test/youtube-retry.test.js \
  test/bot-scheduler.test.js test/album-media.test.js \
  test/auth-access.test.js test/auth-routes.test.js test/auth-proxy.test.js
```

통합 검사는 `--network none` MariaDB 컨테이너와 같은 네트워크 네임스페이스의 일회용 Node 컨테이너에서 `BOT_AUDIT_DB=1`로 실행했다. 테스트용 `/etc/hosts`와 native HTTPS mock으로 OG가 실제 외부에 접속하지 않도록 했다. DB·컨테이너는 검사 후 제거했다.

브라우저 검사는 `frontend/test/external-content.cjs`를 `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` 환경변수로 실행한다. 초기 테스트 도구의 Vite CommonJS export 접근 오류를 고친 후 두 크기 모두 통과했다.

## Codex Security 원본 기록

- 단일 Standard scan: `bddea0f8-2788-4d5e-8cd3-7d46b864755d`.
- 원본 보고서: `/home/caadiq/.codex/state/plugins/codex-security/scans/fromlog/18620809730285fe0cbc02a9a20a45327113dbb9_20260926T135521Z_39n9un4e/report.md`.
- 같은 디렉터리의 `scan-manifest.json`, `findings.json`, `coverage.json` 및 `artifacts/baseline.json`, `artifacts/architecture.json`에 수정 전 근거 보존. 완료된 원본은 수정하지 않았으며, 수정 후 결과는 이 문서와 회귀 테스트로 구분한다.
- 독립 소스 검토 기준 69개 경로를 기록했다. 도구의 저장소 범위 `.`는 사용자 선택 Part7보다 넓어 전체 저장소 커버리지는 **partial**로 기록했다. 전체 762개 파일을 보안 검증했다고 주장하지 않는다.
- 완료 도구는 스캔 중 작업 트리 변경 경고를 표시했다. 해당 시점 변경은 진행 문서이고 취약점 소스 수정은 스캔 완료 뒤 수행했다.
- 도구가 반환한 토큰 집계는 10,081,313(캐시 입력 9,528,704 포함, 3개 스레드 집계)이다. 기존 대화·재사용 스레드가 포함되어 **이번 Part7 단독 사용량이나 과금량으로 해석할 수 없다**.

## 한계·후속

- 실제 Android에서 정상 미디어 저장과 잘못된 인증서 거부는 10번 실기기 검사에 연결한다. 자동 테스트와 릴리스 빌드를 기기 검증으로 대신했다고 주장하지 않는다.
- 현재 파일·표본 응답·최근 300개 로그 항목의 정확 일치 검사이며, Git 이력·전체 과거 로그·모든 인코딩의 비밀값 검사를 의미하지 않는다.
- 외부 Caddy·S3 ACL·Otto 서버 전체 보안, 외부 DNS 인프라 장악은 이번 저장소 검토 범위 밖이다.
- 공개 배포 전 푸시 등록 권한 분리, 외부 수집 네트워크 egress 정책, 다른 관리자 전용 fetch의 크기·기한 통일은 후속 구조 개선 후보이며 현재 확인된 비관리자 취약점과 구분한다.
- 사용자 요청: 공개 일정 달력 전환 애니메이션은 8번 PC·9번 모바일 UI 검증에서 관리자와 비교하여 보완한다. 월·주 전환, 반복 조작, 동작 줄이기 포함.

## 배포 상태

- 백엔드는 dev/prod 공유 `node --watch`이므로 수정 반영됨. 운영 일정·영상·봇 설정 데이터 변경 없음.
- 지도 문자열 보완은 개발 반영·빌드 완료. 운영 프론트엔드 재배포는 하지 않음.
- Flutter는 기존 발행 선호에 따라 **Otto 2.0.0+132 / Android versionCode 2132 발행 완료**. 설치 확인은 사용자 기기에서 필요.

## 구현 계약 참고

- [Node HTTP 요청의 lookup·AbortSignal](https://nodejs.org/api/http.html#httprequesturl-options-callback)
- [IANA IPv4 특수 주소](https://www.iana.org/assignments/iana-ipv4-special-registry/)
- [IANA IPv6 특수 주소](https://www.iana.org/assignments/iana-ipv6-special-registry/)
- [Kakao CustomOverlay](https://apis.map.kakao.com/web/documentation/#CustomOverlay)
