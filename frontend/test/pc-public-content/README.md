# PC 공개 앨범·곡·응원법·미디어 검증

Node + Playwright가 설치된 컨테이너에서 실행한다. 기본 대상은 개발 사이트다. 브라우저 및 모듈 경로는 기존 PC 공개 미디어 검사와 같은 환경변수로 지정한다.

```bash
export AUDIT_BASE_URL=https://dev.fromlog.caadiq.co.kr
export PLAYWRIGHT_MODULE=/path/to/playwright
export AUDIT_OUTPUT=/tmp/fromlog-album-audit
node frontend/test/pc-public-content/verify.cjs
node frontend/test/pc-public-content/layout.cjs
node frontend/test/pc-public-content/player.cjs
node frontend/test/pc-public-content/edges.cjs
node frontend/test/pc-public-content/motion.cjs
node frontend/test/pc-public-content/live.cjs
node frontend/test/pc-public-content/media.cjs
```

- `base.cjs`: 합성 공개 API, GET 외 요청 금지, 외부 호스트 차단. 사진은 로컬 대역 SVG, 기본 영상은 의도적 404.
- `verify.cjs`: 6경로 오류/재시도, 빈 목록/404, 소개창 Tab/Escape/Back, 앨범→곡→가사→응원법, 갤러리 필터/썸네일 대체/확대/파일명·다운로드, 이미지/영상 실패와 복구, 느린 응답.
- `layout.cjs`: 긴 제목/가사/크레딧/18개 티저 × 5경로 × 1100×450/1280×720/1920×1080. 스크롤/넘침/JS 오류와 캡처.
- `player.cjs`: YouTube API 실패 뒤 가짜 플레이어로 재시도, 가사 시점 이동·키보드·종료 정리, MV가 없는 곡의 응원법 링크. 실제 음원과의 싱크를 검증하는 테스트는 아니다.
- `edges.cjs`: Chromium/Firefox/WebKit에서 모달·이미지 점 선택·동작 줄이기·CSS 1.5배 확대, 사진 600개 가상 목록/빠른 이동. 실제 브라우저 설정의 글꼴 확대나 물리 태블릿을 대체하지 않는다.
- `motion.cjs`: 뷰어 4회 개폐 중 중간 투명도 샘플, 스크롤 잠금 복귀, 강제 색상 모드의 소개창.
- `live.cjs`: 실제 공개 앨범 전체 제목, Glow ME 상세·갤러리·Vitamin ME·응원법 읽기/캡처/이미지/다운로드. GET/HEAD 외 요청 차단. 실제 YouTube iframe 로드는 확인하지만 음성 청취·전체 재생은 자동 판정하지 않는다.
- `media.cjs`: 생성한 2초 WebM으로 정상 네이티브 영상 로딩/닫기, 실제 S3 원본 다운로드 완료·파일명·WebP 헤더 확인.

`fixtures/video.webm`은 외부 저작물이 아닌 단색 검사용 영상이다. 다음으로 재생성할 수 있다.

```bash
ffmpeg -v error -f lavfi -i color=c=0x75927e:s=160x90:r=5:d=2 -an -c:v libvpx -b:v 40k -y frontend/test/pc-public-content/fixtures/video.webm
```

수정 전 오류 재현 결과는 로컬 `/tmp/fromlog-album-audit/baseline.json`에 보관했다. 결과/배포 범위는 [14번 기록](../../../docs/validation/14-pc-public-content.md)을 참고한다.
