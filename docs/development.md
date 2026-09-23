# 개발/배포 가이드

## 앨범 수정 회귀 테스트

`backend/test/album-update.test.js`는 실제 MariaDB의 트랙 번호 UNIQUE 제약과
응원법 ON DELETE CASCADE를 사용해 앨범 수정의 데이터 보존을 검증한다.
설명/커버 수정, 트랙 편집·순서 교환·추가·삭제, 잘못된 요청, 저장 실패 롤백 등 13개를 검사한다.
이미지 업로드는 S3 대역으로 처리하며 운영 스토리지에는 쓰지 않는다.

운영 DB와 분리한 임시 컨테이너에서 실행한다. 아래 명령은 프로젝트 루트 기준이며,
기존 백엔드 이미지와 설치된 `backend/node_modules`를 사용한다.
테스트 DB는 외부 네트워크와 포트를 열지 않고 메모리에만 저장한다.

```bash
docker run -d --rm --name fromlog-album-test-db --network none \
  --tmpfs /var/lib/mysql \
  -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 \
  -e MARIADB_DATABASE=fromlog_test_album mariadb:11

# 성공할 때까지 준비 상태를 확인한다.
docker exec fromlog-album-test-db healthcheck.sh --connect --innodb_initialized

docker run --rm --network container:fromlog-album-test-db \
  -v "$PWD/backend:/app:ro" -w /app \
  -e JWT_SECRET=album-tests-only -e ALBUM_TEST_HOST=127.0.0.1 \
  --entrypoint npm fromlog-fromlog-backend run test:album

docker stop fromlog-album-test-db
```

테스트는 애플리케이션의 `DB_*` 설정을 사용하지 않는다. 명시한 `ALBUM_TEST_HOST`의
`fromlog_test_album` DB에만 접속한다. 테스트 전용 DB의 fixture 데이터는 매 테스트마다 초기화된다.

## 앨범 미디어 UUID 이전

앨범 사진·티저의 저장 파일명은 표시 순서와 독립적인 UUID다. 기존 `album_photos`와
`album_teasers`의 URL 컬럼으로 관리하며 테이블/컬럼 추가는 없다.
앨범 커버, 멤버 프로필, 일정 포스터는 이 이전 대상에 포함하지 않는다.

회귀 테스트는 실제 업로드·삭제 라우트와 이미지 변환을 실행하고 DB/S3 입출력만 대역으로 처리한다.
삭제·순서 압축 후 재업로드, 동일 번호의 티저 이미지/영상, 티저 자동 순서,
기존 URL 이전 계획과 재실행/충돌 검사를 포함한 10개 테스트다.

```bash
docker compose exec -T fromlog-backend npm run test:media
```

이전 도구는 `backend/scripts/migrate-album-media-ids.mjs`다. 프로젝트 루트에서
별도의 비공개 백업 디렉터리를 사용한다. 아래는 2026-09-05 실행에 사용한 디렉터리이며,
새 이전 계획을 만들 때는 새 경로를 사용한다. 기존 snapshot/manifest는 덮어쓰지 않는다.

```bash
# plan → copy → apply → verify 순으로, 각 명령이 성공한 뒤 다음 단계 실행
docker compose run --rm --no-deps -T --user "$(id -u):$(id -g)" \
  --entrypoint node \
  -v /docker/fromlog/backups/album-media-uuid-20260905:/migration \
  fromlog-backend scripts/migrate-album-media-ids.mjs plan /migration
```

- `plan`: DB 행·멤버 태그를 `snapshot.json`에 백업하고, 이전 전후 URL과 S3 객체 정보(ETag·크기)를 `manifest.json`에 기록한다. 모든 원본의 존재와 대상 경로 미사용을 확인한다.
- `copy`: 새 UUID 경로로 복사하고 원본/복사본 SHA-256을 비교한다. `copied.json`에 검증 결과를 저장하여 중단 후 재개할 수 있다. 원본 파일은 삭제하지 않는다.
- `apply`: 모든 복사본을 확인하고 URL 컬럼만 한 트랜잭션에서 변경한다. 계획 이후 URL이나 앨범 폴더가 바뀌었으면 중단한다. 캐시 무효화와 활동 로그를 기록한다.
- `verify`: 새 파일 전체 SHA-256, 전환된 URL, ID·표시 순서·컨셉·크기 등 기존 메타데이터와 멤버 태그 보존을 검증한다.
- `rollback`: 위 명령의 `plan`을 `rollback`으로 바꾼다. 보존된 원본의 SHA-256을 확인한 뒤 DB URL만 복구한다. 이후 편집으로 URL이 달라진 행은 덮어쓰지 않고 중단한다. 파일 삭제는 수행하지 않는다.

동일 백업 디렉터리에 여러 실행을 동시에 시작하지 않는다. 이전 중에는 해당 앨범의 편집·삭제를 피한다.
`backups/`는 Git에서 제외되며 백업 파일은 비공개로 보관한다.
환경 변수는 Compose의 `env_file` 처리를 사용한다. `.env`를 `docker run --env-file`에 직접
넘기면 따옴표 처리 차이로 인증이 실패할 수 있다.

2026-09-05 운영 이전 완료: 컨셉 포토 **590건**, 티저 **13건**(영상 2개 포함),
스토리지 객체 **1,811개 / 3,184,814,792바이트**. 전환 후 전체 SHA-256과 DB 메타데이터·멤버 태그 검증 통과.
기존 파일은 모두 보존했으며 자동 정리하지 않는다. 백업은 위 경로의 snapshot/manifest/copied/apply/verified JSON에 있다.
백엔드와 DB 변경은 운영에 반영되었다. 관리자 표시 순서 안내 문구는 dev에서 확인하며 프론트 prod 배포는 별도다.

## 서빙 구조 (프로덕션/개발 병행)

| 도메인 | 컨테이너 | 내용 |
|--------|---------|------|
| `fromlog.caadiq.co.kr` | `fromlog-frontend-prod` | **프로덕션** — `vite build` 결과물을 nginx 정적 서빙 |
| `dev.fromlog.caadiq.co.kr` | `fromlog-frontend` | **개발** — Vite watch, 소스 수정 즉시 반영 (HMR) |

두 컨테이너는 같은 `frontend/` 소스를 사용한다. dev는 마운트된 소스를 실시간으로,
프로덕션은 **이미지 빌드 시점의 스냅샷**을 서빙한다.

### 프로덕션 배포 (프론트엔드)
dev에서 확인이 끝난 뒤 이 한 줄이면 반영된다:
```bash
cd /docker/fromlog && docker compose up -d --build fromlog-frontend-prod
```
- `frontend/Dockerfile.prod` — node 빌드 스테이지 → nginx 정적 서빙
- `frontend/nginx.conf` — SPA 폴백, `/api`·`/docs` → 백엔드 프록시, `/assets` 장기 캐시
- 백엔드는 볼륨 마운트 + watch라 프론트 배포와 무관하게 즉시 반영됨

## 개발 모드

### 실행
```bash
cd /docker/fromlog
docker compose up -d --build
```

### 컨테이너 구성
| 컨테이너 | 포트 | 설명 |
|---------|------|------|
| `fromlog-frontend` | 80 | Vite 개발 서버, HMR 지원 (dev.fromlog) |
| `fromlog-frontend-prod` | 80 | nginx 프로덕션 서빙 (fromlog) |
| `fromlog-backend` | 80 | Fastify API, --watch 모드 |
| `fromlog-meilisearch` | 7700 | 검색 엔진 |
| `fromlog-redis` | 6379 | 캐시 |

- dev는 Vite가, 프로덕션은 nginx가 `/api`, `/docs` 요청을 백엔드로 프록시

### 로그 확인
```bash
# 전체 로그
docker compose logs -f

# 백엔드만
docker compose logs -f fromlog-backend

# 프론트엔드만
docker compose logs -f fromlog-frontend
```

### 코드 수정
- `frontend/`, `backend/` 폴더가 컨테이너에 마운트됨
- `node_modules`도 호스트 폴더에 직접 설치됨
- 코드 수정 시 자동 반영 (HMR, watch)

### 재시작
```bash
# 백엔드만 재시작
docker compose restart fromlog-backend

# 프론트엔드만 재시작
docker compose restart fromlog-frontend

# 전체 재시작
docker compose restart
```

---

## 배포 모드 전환

### 1. Dockerfile 수정

**backend/Dockerfile:**
```dockerfile
# 개발 모드 주석처리
# FROM node:20-alpine
# ...

# 배포 모드 주석해제
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**frontend/Dockerfile:**
```dockerfile
# 개발 모드 주석처리
# FROM node:20-alpine
# ...

# 배포 모드 주석해제
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2. 빌드 및 실행
```bash
docker compose up -d --build
```

---

## 환경 변수 (.env)

```env
# 서버
PORT=80

# 데이터베이스
DB_HOST=mariadb
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=fromlog

# Redis
REDIS_HOST=fromlog-redis
REDIS_PORT=6379

# Meilisearch
MEILI_HOST=http://fromlog-meilisearch:7700
MEILI_MASTER_KEY=...

# JWT
JWT_SECRET=...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
S3_BUCKET=...

# YouTube API
YOUTUBE_API_KEY=...
```

---

## Caddy 설정

위치: `/docker/caddy/Caddyfile`

### 프롬로그 사이트 설정
```caddyfile
fromlog.caadiq.co.kr {
    import custom_errors
    reverse_proxy fromlog-frontend-prod:80
}
```

> 구 주소 `fromis9.caadiq.co.kr`은 2026-08 제거됨. 앱도 `apiBaseUrl`을 새 주소로
> 바꿔 발행(code 2093)했으므로 더는 참조하지 않는다.

### 설정 설명
- `import custom_errors`: 공통 에러 페이지 (403, 404, 500, 502, 503)
- `reverse_proxy fromlog-frontend:80`: Docker 네트워크로 프론트엔드 컨테이너에 연결
- 업로드 크기 제한 없음 (Caddy 기본값)

### Caddy 재시작
```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### 네트워크 구조
```
인터넷 → Caddy (:443) → fromlog-frontend-prod (:80) → fromlog-backend (:80)
                                               ↓
                         MariaDB, Redis, Meilisearch (내부 네트워크)
```

---

## 프론트엔드 개발 가이드

### API 클라이언트 구조

```
src/api/
├── index.js          # 전체 export
├── client.js         # api, authApi 헬퍼 (에러 처리, 토큰 주입)
├── public/           # 공개 API (인증 불필요)
│   ├── albums.js     # getAlbums, getAlbumByName, getTrack
│   ├── members.js    # getMembers
│   └── schedules.js  # getSchedules, getSchedule, getCategories
└── admin/            # 관리자 API (인증 필요)
    ├── auth.js       # login, verifyToken
    ├── albums.js     # createAlbum, updateAlbum, deleteAlbum, ...
    ├── bots.js       # getBots, startBot, stopBot, syncBot, getXBot, createXBot, updateXBot, deleteXBot, lookupXProfile
    ├── categories.js # getCategories, createCategory, updateCategory, ...
    ├── members.js    # updateMember
    ├── schedules.js  # getYoutubeInfo, saveYoutube, getXInfo, saveX, ...
    ├── stats.js      # getStats
    └── suggestions.js # getDict, saveDict
```

**client.js 헬퍼:**
```jsx
// 공개 API 헬퍼 (인증 불필요)
import { api } from '@/api/client';

api.get('/albums');
api.post('/schedules/suggestions/save', { query: '검색어' });

// 인증 API 헬퍼 (토큰 자동 주입)
import { authApi } from '@/api/client';

authApi.get('/admin/stats');
authApi.post('/admin/schedules', data);
authApi.put('/admin/albums/1', data);
authApi.del('/admin/schedules/1');
```

**사용 예시:**
```jsx
// 공개 API
import { getSchedules, getSchedule } from '@/api/public/schedules';

// 관리자 API
import * as botsApi from '@/api/admin/bots';
```

### React Query 사용 (데이터 페칭)

데이터 페칭 시 `useEffect` 대신 `useQuery`를 사용합니다.

**이유:**
- `useEffect`는 React StrictMode에서 2번 실행됨 (개발 모드)
- `useQuery`는 자동 캐싱, 중복 요청 방지, 에러/로딩 상태 관리 제공

**예시:**
```jsx
// ❌ Bad - useEffect 사용
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(data => setData(data))
    .finally(() => setLoading(false));
}, []);

// ✅ Good - useQuery 사용
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['data'],
  queryFn: () => fetch('/api/data').then(res => res.json()),
});
```

**캐시 무효화:**
```jsx
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// 특정 쿼리 무효화
queryClient.invalidateQueries({ queryKey: ['schedules'] });

// 모든 쿼리 무효화
queryClient.invalidateQueries();
```

---

## Flutter 월별 일정 응답 순서 보장

2026-09-06 F05 수정. `ScheduleController`는 요청 시작 시 선택한 연·월과 요청 ID를 고정한다.
응답은 그 월의 캐시에만 저장하며, 현재 화면의 목록·로딩·오류는 최신 화면 요청만 갱신한다.
같은 월에서 새로고침을 여러 번 하거나 다른 달로 갔다 돌아와도 먼저 시작한 요청이 최신 데이터를 덮어쓰지 않는다.

달력 미리 불러오기도 월별 요청 ID를 공유한다. 해당 월을 이미 불러오는 중이면 중복 요청을 생략하고,
미리 불러오기 이후 시작한 화면 요청을 더 최신으로 취급한다. 배경 응답은 현재 화면의 오류를 지우지 않는다.
월 이동 직후에는 해당 월의 캐시 또는 빈 목록을 사용해 이전 월의 일정이 잠시 표시되지 않도록 한다.
Provider 초기화/종료 시 기존 요청을 무효화하고 늦은 응답의 상태 접근을 막는다.

```bash
cd /docker/fromlog/app
flutter test --no-pub test/schedule_controller_test.dart --reporter expanded
flutter analyze --no-pub
```

회귀 테스트 12개는 실제 Riverpod 컨트롤러와 Dio 응답 처리를 사용하며 HTTP 어댑터만 대역으로 바꾼다.
응답 역전, 오래된 오류, 같은 달 새로고침, 달력 미리 불러오기 경쟁/중복, 날짜 선택, 월 왕복,
캐시 없는 월 이동, Provider 재생성/종료를 확인한다. 실제 서버 요청은 보내지 않는다.
변경 파일 분석은 문제 0건이며, 전체 분석에는 기존 파일의 info 수준 지적 10건이 남아 있다.
기기에서의 수동 화면 조작은 이 검증에 포함하지 않는다.

2026-09-06 Android arm64 릴리스 빌드 및 Otto 발행 완료: `2.0.0+126` (versionCode `2126`).

## Flutter 검색 응답 순서 보장

2026-09-06 F06 수정. `ScheduleSearchController`는 검색 실행·빈 검색어·초기화·Provider 종료/초기화 시
요청 번호를 변경한다. 검색과 더 보기 응답은 자신이 시작된 검색 번호가 여전히 유효할 때만
목록·offset·hasMore·로딩·오류를 갱신한다. 같은 검색어를 연속 실행해도 최신 요청을 기준으로 한다.
첫 페이지 로딩 중에는 더 보기를 막고, 추가 페이지 실패 시 같은 offset으로 재시도할 수 있다.

`SuggestionController`도 독립적인 요청 번호로 추천 검색어를 보호한다. 입력 변경 즉시 기존 추천을
비우고 이전 응답을 무효화한다. 화면의 200ms 디바운스 타이머는 입력 지우기·검색 실행·추천 화면
닫기·검색 종료 시 취소한다. 네트워크 요청 자체를 취소하는 방식은 아니며 늦은 응답을 무시한다.

```bash
cd /docker/fromlog/app
flutter test --no-pub test/schedule_search_controller_test.dart \
  test/schedule_search_view_test.dart test/schedule_controller_test.dart --reporter expanded
flutter analyze --no-pub
```

검색 컨트롤러 16개 + 실제 `ScheduleView` 위젯 테스트 3개 + 월별 일정 회귀 12개 = **31개 통과**.
HTTP 어댑터만 대역으로 바꿔 성공/실패 응답 순서를 제어한다. 검색어 전환·같은 검색어 재검색·초기화,
이전 추가 페이지의 성공/실패·페이지 중복 방지·실패 재시도·추천 검색어 경쟁·Provider 재생성/종료와
실제 화면의 디바운스 중 입력 변경/지우기/검색 실행을 검증한다.
변경 파일의 분석은 문제 0건이며 앱 전체의 기존 info 수준 지적 10건은 별도다.
실제 휴대폰의 수동 조작 검증은 포함하지 않았다.

웹 `useSuggestions`의 유사한 응답 순서 문제는 소스 확인만 했으며, 이번 앱 수정 범위에 포함하지 않았다.

2026-09-06 Android arm64 릴리스 빌드 및 Otto 발행 완료: `2.0.0+127` (versionCode `2127`).
업데이트 조회 응답과 로컬 APK의 SHA-256 일치를 확인했다.

## Flutter 업데이트 확인 시간 제한

2026-09-06 F07 수정. `UpdateService.checkForUpdate()`의 HTTP 요청과 응답 본문 수신에
5초 제한(`checkTimeout`)을 적용한다. 완료/실패/시간 초과 모두 전용 HTTP 클라이언트를 닫는다.
시간 초과 예외는 기존 `SplashGate`의 실패 처리로 전달되어 네이티브 스플래시를 제거하고 홈으로 이동한다.
제한은 업데이트 확인 요청에만 적용하며, 정상 응답으로 받은 강제 업데이트 다이얼로그에는 적용하지 않는다.
타임아웃 후 늦게 온 응답도 다이얼로그를 다시 띄우지 않는다.

```bash
cd /docker/fromlog/app
flutter test --no-pub test/update_startup_test.dart --reporter expanded
flutter analyze --no-pub
```

실제 `SplashGate`·GoRouter·업데이트 다이얼로그와 HTTP 대역을 사용한 위젯 테스트 5개 통과:
무응답 서버의 5초 제한 및 늦은 응답 무시, HTTP 204/500 진입, 강제 업데이트 진입 차단 유지,
선택 업데이트 닫기 후 홈 진입. 실제 Otto 장애를 일으키거나 휴대폰에서 수동 검증한 것은 아니다.
변경 파일 분석 문제 0건이며, 전체 분석의 기존 info 지적 10건은 별도다.

2026-09-06 Android arm64 릴리스 `2.0.0+128` (versionCode `2128`) Otto 발행 완료.
업데이트 조회와 APK SHA-256 일치를 확인했다.

## 수집 큐 등록 재시도

2026-09-06 F04 수정. `bot_pending_schedules.created_schedule_id`를 등록 시작 시점부터 사용한다.
스키마 변경은 없다. 한 큐 항목에서 새 일정은 최대 한 번 생성한다.

1. 큐 행을 `SELECT ... FOR UPDATE`로 잠그고 일정 생성과 큐 ID 연결을 같은 트랜잭션으로 커밋한다.
2. 다음 트랜잭션에서 큐/일정 행을 다시 잠그고 포스터 업로드·`images` 저장·포스터 연결·등록 완료를 수행한다.
3. 2단계가 실패하면 일정과 큐 연결은 유지되고 이미지 DB 변경만 롤백된다. 다음 요청은 기존 일정 ID로 2단계부터 재개한다. 완료된 항목 재요청은 같은 ID만 반환한다.

재시도는 포스터에만 적용된다. 기존 일정 제목·날짜·분류 등은 일정 관리에서 수정한다.
포스터 없이 재시도해도 등록을 완료할 수 있다. 등록 시작 후에는 무시를 차단하며,
DC봇의 미정 날짜 갱신/중복 행 제거도 `created_schedule_id IS NULL`인 미등록 행만 대상으로 한다.
잠금은 해당 큐/일정에 한정되지만 포스터 S3 I/O 동안 유지되므로 같은 항목의 동시 요청은 대기할 수 있다.

큐 포스터는 변환 형식과 일치하는 UUID `.webp` 파일명을 사용한다.
실패한 시도의 S3 객체는 DB에서 참조되지 않은 채 남을 수 있으며 자동 삭제하지 않는다.
DB 커밋 응답 유실 시 실제 커밋 여부가 불확실하므로 오류만 보고 파일을 지우지 않는다.
기존 실패로 큐 연결이 남지 않았던 과거 일정의 추정 연결/중복 삭제나,
큐를 거치지 않는 직접 생성 요청의 중복 방지는 이번 범위에 포함하지 않는다.

### 수집 큐 통합 테스트

실제 MariaDB/InnoDB와 Fastify multipart 라우트, 이미지 변환을 사용한다.
S3·검색 인덱스 쓰기는 대역으로 처리하며 운영 DB와 네트워크는 사용하지 않는다.
포스터 손상·S3 장애·링크 저장/완료 갱신 DB 오류, 동시 등록 3개, 등록/무시 경쟁,
삭제된 일정, 4개 카테고리 생성, 기존 포스터/제목 보존과 공용 생성 함수 등 15개를 검증한다.

```bash
docker run -d --rm --name fromlog-pending-test-db --network none \
  --tmpfs /var/lib/mysql \
  -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 \
  -e MARIADB_DATABASE=fromlog_test_pending mariadb:11

# 준비 완료 후 테스트 실행
docker exec fromlog-pending-test-db healthcheck.sh --connect --innodb_initialized
docker run --rm --network container:fromlog-pending-test-db \
  -v "$PWD/backend:/app:ro" -w /app \
  -e JWT_SECRET=pending-tests-only -e PENDING_TEST_HOST=127.0.0.1 \
  --entrypoint npm fromlog-fromlog-backend run test:pending

docker stop fromlog-pending-test-db
```

공유 일정 생성 서비스는 `insert*Schedule(conn, data)`에 DB 쓰기를 모았다.
이 함수는 호출자가 트랜잭션과 커밋 후 검색 동기화를 책임진다.
기존 `create*Schedule(db, meilisearch, data, redis)`는 이전처럼 자체 트랜잭션과 검색 동기화를 수행한다.

## YouTube 봇 동기화

### 동기화 흐름 (syncNewVideos)
1. `fetchRecentUploads()` — Activities API로 최근 업로드 조회 (1 unit).
   **snippet(제목·설명)이 함께 오므로 그대로 반환** — 제목 필터를 추가 API 호출 없이 적용
2. 일정에 등록된 것(`schedule_youtube`) + 이전에 거부된 것(`youtube_skipped_videos`) 제외.
   **일정 생성 봇은 `videos`에만 저장된 영상을 완료로 보지 않는다.** 상세 API/일정 DB 저장이
   실패하면 다음 수집에서 다시 처리한다. 아카이브 저장은 `INSERT IGNORE`로 기존 데이터를 유지한다.
   아카이브 전용 봇(`add_to_schedule=0`)은 이미 저장된 영상의 타입과 최근 업로드의 제목·날짜로
   예정 일정 승격을 다시 시도한다. 승격된 영상은 `schedule_youtube`로 완료를 판정하며,
   매칭되는 예정 일정이 없으면 새 일정을 만들지 않는다. 이 재시도에는 추가 YouTube API 호출이 없다.
3. **제목 필터** — 1의 snippet **title + description**으로 판별 (API 비용 0). 거부분은 스킵 캐시에 기록
   > 워크돌 쇼츠처럼 제목에는 키워드가 없고 설명란 해시태그(#프로미스나인)에만 출연자가
   > 표기되는 채널이 있어 설명란까지 본다. '지원' 같은 흔한 단어를 필터로 쓰면
   > 무관 영상(김지원, 지원 부탁 등)이 걸리므로 필터는 고유 명칭만 사용할 것.
   >
   > 제목·설명란이 **모두 빈 쇼츠**는 `fetchShortsLinkedVideo()`로 폴백 판별한다 —
   > 쇼츠 하단 "이 영상에서" 연결 본편은 Data API에 없어서 쇼츠 페이지 HTML의
   > watchEndpoint + accessibilityText에서 추출한다 (쿼터 소모 없음).
   > ⚠️ 한글 정규화: YouTube API는 제목을 **NFD**로 반환하는데 DB의 필터 문자열은 보통 **NFC**라
   > 그냥 `includes`하면 눈으로 같아 보여도 안 걸린다. 비교는 반드시 `normText()`(NFC + 소문자)를 거칠 것.
4. **쇼츠 판별** — `getVideoDurations()` 배치로 최대 50개를 **1 unit**에 판별.
   거부분은 스킵 캐시에 기록
   > ⚠️ 쇼츠는 **최대 3분**(2024-10 확대)이라 duration만으론 1~3분 쇼츠를 일반 영상으로
   > 오판한다 (2026-07-22 스프 66초·73초 쇼츠 오등록 사고). 3분 초과만 즉시 일반 영상으로
   > 확정하고, 3분 이하는 `youtube.com/shorts/{id}` HEAD 리다이렉트(쇼츠=200, 일반=3xx)로
   > 정확 판별한다 — API 쿼터 소모 없음. 리다이렉트 실패 시 60초 기준 폴백.
   > `{ isShorts, seconds }`를 함께 돌려주므로 `videos.duration`(영상 길이, 초) 저장에
   > 추가 API 호출이 들지 않는다. 쇼츠는 길이가 정보가 못 되어 웹에서 배지를 그리지 않는다.
   > 기존 영상 백필: `node scripts/backfill-duration.mjs --apply` (50개당 1 unit)
5. 필터를 통과한 영상만 `fetchVideoInfo()` (영상당 1 unit) → `saveVideo()` + Meilisearch 동기화

### 수집 실패 재시도 회귀 테스트

```bash
docker compose exec -T fromlog-backend npm run test:youtube
```

`backend/test/youtube-retry.test.js`는 실제 봇·API 응답 처리·트랜잭션 코드를 실행하며
외부 HTTP와 DB 입출력은 대역으로 처리한다. 운영 API/DB에는 쓰지 않는다.
상세 조회 예외/빈 결과, 일정 DB 실패 후 롤백·재시도, 여러 후보 일괄 아카이브 후 실패,
이미 등록/제외된 영상, 제목/쇼츠 필터, 아카이브 전용 봇의 예정 일정 승격 재시도와
매칭 없는 경우를 포함한 8개 테스트다. 실제 MariaDB/Meilisearch 통합 검증은 포함하지 않는다.

2026-09-06 F03 수정: 별도 스키마 변경 없이 위 완료 판정을 적용했다.
재시도 범위는 기존과 같이 Activities API가 반환하는 최근 업로드 **최대 50개**다.
이 범위에 남아 있는 기존 누락 후보도 다음 수집에서 재평가된다. 범위 밖의 과거 누락을
찾아 복구하는 전체 백필은 수행하지 않았다. 검색 인덱스 동기화 실패나 다음 주 예정 일정
생성 실패의 별도 복구는 이번 변경 범위에 포함하지 않는다.

### 스킵 캐시 (youtube_skipped_videos) — 할당량 누수 방지
쇼츠 제외/제목 필터로 **거부된 영상은 `schedule_youtube`에 저장되지 않아**, 캐시가 없으면
매 sync마다 "새 영상"으로 판단되어 `videos.list`(영상당 1 unit)로 **영원히 재조회**된다.
(2026-07 실측: 스프 채널 쇼츠 3개 × 1440회/일 = **4,320 units/일 낭비**, 전체의 60%)

- 거부된 video_id를 `youtube_skipped_videos`에 기록해 2단계에서 제외
- 봇의 `title_filters`/`exclude_shorts` 수정 시 해당 채널 레코드를 삭제해 재평가되게 함
  (`PUT /api/admin/youtube-bots/:id`)

### API 할당량
- 일일 할당량: 10,000 units
- 새 영상 없을 때: activities.list **1 unit**만 소비 (평상시 대부분)
- 새 영상 있을 때: 1 + (쇼츠 판별 배치 1) + 통과한 영상 수 units
- **1분 간격 상시 봇 2채널 기준: ~2,880 units/일 (29%)** — 최적화 전 ~7,200 (72%)
- weekly 모드 봇은 평상시 호출 없음

### 폴링 모드 (bot_youtube)

두 가지 모드 중 하나를 선택 — 봇 레코드에 `cron_interval`(분) 또는 `weekly_schedule_config`(JSON) 중 하나가 채워짐.

**상시 폴링 (기본)**
- `cron_interval`이 분 단위로 지정됨. cron: `*/N * * * *`
- 매주 여러 날 업로드하는 채널에 적합 (예: `studio_fromis_9`)

**주간 지정 시간 (weekly)**
- `weekly_schedule_config: { dayOfWeek, startTime, intervalSeconds, durationMinutes }` 
- 주 1회만 특정 요일·시각에 업로드되는 채널용 (예: 워크맨 매주 수 19:00)
- cron: `mm hh * * dayOfWeek` — 시작 시각 1회만 트리거
- 트리거 시 `startWeeklyBurst()`가 `setInterval`로 `intervalSeconds`마다 폴링
- **종료 조건** (둘 중 먼저):
  1. **당일(KST) 게시된 일반 영상** 저장 (stopOnFound) — 백로그(지난 날짜) 영상만
     추가된 경우에는 계속 폴링 (2026-07-08 워크돌 미등록 사고 재발 방지)
  2. `durationMinutes` 경과
- 평상시에는 API 호출 없음 → 할당량 최소화
- **임시(예정) 일정 deadline 정리**: 매일 00:05 KST 별도 cron이 전체 유튜브 봇의
  `checkScheduledDeadline`을 실행 — deadline 요일에 전날 임시 일정이 남아 있으면
  삭제 후 다음 주 예정 일정 생성 (weekly 봇은 sync가 주 1회뿐이라 sync 내부
  체크만으로는 실행 기회가 없음)
- `burstTimers` Map에서 봇 ID별 내부 타이머 추적, `stopBot()`에서 같이 정리

두 모드 모두 `MAX_CONSECUTIVE_ERRORS` (기본 10회) 자동 정지 로직이 공통 적용됨.

### 주요 API 함수 (services/youtube/api.js)
| 함수 | YouTube API | 용도 |
|------|-----------|------|
| `fetchRecentVideoIds()` | activities.list (1 unit) | 최근 영상 ID 목록 조회 |
| `fetchVideoInfo()` | videos.list (1 unit) | 단일 영상 상세 정보 |
| `fetchAllVideos()` | playlistItems.list + videos.list | 전체 영상 초기 동기화 |
| `getChannelByHandle()` | channels.list (1 unit) | 핸들로 채널 조회 |
| `getChannelInfo()` | channels.list (1 unit) | 채널 정보 (배너 등) |

---

## 영상 아카이브 (videos)

**쇼츠 정책 두 가지** — 헷갈리기 쉬우니 구분할 것.
- `exclude_shorts`: 쇼츠를 **일정에만** 넣지 않는다. 영상 페이지에는 그대로 쌓인다
- `archive_shorts`(기본 켬): 끄면 쇼츠를 **영상 페이지에도** 담지 않는다.
  풀무원처럼 쇼츠 대부분이 게스트 단독 클립이라 제목·설명으로 가려낼 수 없는 채널용

일정과 분리된 영상 페이지의 데이터원. 봇 sync·백필·수동 등록이 `services/videos.js`의
`archiveVideo()`를 공통으로 사용한다. 봇의 `add_to_schedule = 0`이면 일정은 만들지 않고
영상만 적재한다 (음방 채널이 여기 해당).

**X봇 발견 영상** — 트윗에서 감지된 유튜브 영상 중 봇 미등록 채널 것은 일정과 함께
아카이브에도 적재된다. 채널 기반 분류가 불가능하므로 `classifyMusicTitle()` 제목 판별로
무대(`music`)/기타(`variety`)를 가른다 (관리자 수동 등록의 `inferCategory`도 동일 규칙).

**봇 미등록 채널 과거분 백필** — `backfill-channel.mjs`:
```bash
docker exec fromlog-backend node scripts/backfill-channel.mjs \
  --channel=@musinsatv --match=프로미스나인,이채영 --pages=10 --apply
```
제목+설명란 키워드 매칭, 5인 체제 컷·쇼츠 판별 자동 적용. (MUSINSA TV 성수기 134건이 이 방식)

**5인 체제 컷** — 아카이브는 5인 체제(2025-01-26) 이후 콘텐츠만 담는다.
`archiveVideo()`가 `ARCHIVE_MIN_DATE` 이전 업로드를 거부하므로 백필을 다시 돌려도
과거 영상이 재유입되지 않는다. 컷 이후 업로드됐지만 8인 무대인 2024 가요대제전 같은
예외는 `cleanup-5member-era.mjs`로 정리했다 (비공개 영상·쇼츠 오판 교정 포함).

### 카테고리 판별 (services/videoCategory.js)

카테고리는 기본적으로 봇의 `video_category`를 따르지만, **`music`(무대 · 퍼포먼스)일 때만** 제목으로
한 번 더 거른다. 음방·직캠 채널은 무대뿐 아니라 자체 예능·라디오·챌린지도 올리기 때문에
채널만 보고 넣으면 「더 시즌즈」 토크 같은 예능이 음방에 섞인다.

예능 키워드를 빼는 블랙리스트는 코너가 새로 생길 때마다 새므로, **무대로 볼 근거가 있을
때만 음방으로 인정**하는 방향으로 판별한다. `classifyMusicTitle()`의 순서:

1. **예능 확정 키워드** — 비하인드·챌린지·셀프캠·포토이즘, 그리고 노래는 부르지만 무대가
   아닌 라이브·라디오 코너(리무진서비스, 아이돌라디오, 잇츠라이브, 초대석) → `variety`
2. **곡명 사전 매칭** (`album_tracks`, 10분 캐시) → `music`
   무대·직캠·라이브는 예외 없이 제목에 곡명이 있고 예능은 없다.
3. **무대 표기 키워드** — 직캠·fancam·릴레이댄스·교차편집·안무 영상·1위·앵콜·모아보기(.zip) → `music`
   > `무대`는 단독으로 쓰지 않는다 — "무대 찢고" 같은 비유 표현이 걸린다(2026-08 풀무원 예능 오분류).
   > 실제 무대 영상은 곡명·직캠·제목 구조로 이미 잡히므로 `컴백 무대`·`무대 영상` 같은 복합어만 본다.
4. **제목 구조** — `fromis_9 - 곡명 [프로그램]` 또는 `곡명 - fromis_9` → `music`
   곡명 사전에 없는 커버곡·축제 무대(8282, 짧은 치마)를 여기서 건진다. 프로그램명
   (엠카운트다운 등)을 키워드로 쓰면 그 채널의 예능이 다시 딸려오므로 형식으로만 본다.
5. 아무것도 안 걸리면 `variety`

곡명 대조 시 주의점:
- **NFKC 정규화** — 전각 `＃menow`, 장식 유니코드(`𝑶𝑶𝑻𝑴`)를 일반 문자로 되돌린다
- **단어 경계 검사** — `fromis_9` 안의 곡 `from`, `HERE WE GO` 안의 곡 `WE GO` 같은
  우연한 부분 일치를 막는다. 앞쪽은 공백을 건너뛴 문자가 단어 문자면 탈락시키고,
  뒤쪽은 문자 종류가 바뀔 때만 허용한다(`Vitamin ME까지`는 통과)

앨범 수록곡을 추가·수정했다면 `clearSongCache()`로 캐시를 비운다.

### 재분류 스크립트

판별 규칙을 고친 뒤 기존 데이터에 반영할 때:

```bash
docker exec fromlog-backend node scripts/reclassify-music.mjs          # dry run
docker exec fromlog-backend node scripts/reclassify-music.mjs --apply  # 반영
```

---

## 행사 (Event)

`schedule_categories`의 "행사" 카테고리(id=11)로 일반 일정과 분리된 상세 테이블(`schedule_event`)을 가짐. 세부 타입(`subtype`)으로 폼/UI를 분기.

### 세부 타입
| slug | label | 현재 사용 필드 |
|------|-------|---------------|
| `university` | 학교 축제 | `school_name`, venue(카카오맵), 멤버, 포스터 다중, URL 다중 |

추가 세부 타입을 도입할 때는 1) `frontend/src/pages/pc/admin/schedules/form/event/index.jsx` 의 `SUBTYPES` 상수에 추가, 2) 필요 시 `schedule_event` 컬럼 확장 (또는 `details JSON`), 3) `routes/admin/events.js`의 `VALID_SUBTYPES`, 4) 상세 페이지 섹션(`EventSection`, `MobileEventSection`)에 분기 추가.

### 장소 관리
- `event_venues` 테이블에 `name`/`address`/`road_address`/`lat`/`lng`/`kakao_id` 저장
- 카카오맵 검색은 기존 `/api/admin/kakao/places` 엔드포인트 재사용 (콘서트와 동일)
- `kakao_id` 기준 upsert — 같은 장소가 여러 행사에서 쓰여도 row는 1개

### 포스터 업로드 경로
S3: `event/{scheduleId}/poster/{original|medium_800|thumb_400}/{파일명}`
`services/image.js` 의 `uploadEventPoster(scheduleId, filename, buffer)` 사용.

### Meilisearch 검색 지원
- `source_name`에 `school_name`이 들어가 Meilisearch 검색 가능
- 부분 입력 대응: `resolveSchoolNames(db, query)` 가 `schedule_event` 테이블에서 LIKE로 부분 일치 학교명을 찾아 검색 쿼리를 확장 (예: "인천대" → "인천대학교" 쿼리 추가). 멤버 별명 확장과 동일한 패턴.

---

## X 봇 / Nitter

X 봇은 `/docker/nitter/`의 Nitter 인스턴스(zedeus/nitter)를 스크래핑하여 트윗을 수집합니다. 백엔드는 `NITTER_URL`(기본값 `http://nitter:8080`)로 접속합니다.

### 세션 관리 (`sessions.jsonl`)
X는 비로그인 API 접근을 막고 있어, Nitter는 `/docker/nitter/sessions.jsonl`에 저장된 실제 X 계정 쿠키(`auth_token`, `ct0`)로 요청을 보냅니다.

- 세션이 만료/차단되면 Nitter 측에서 `no sessions available for API` 로그가 찍히고 SIGSEGV로 크래시 → 백엔드에서 `[x-N] 동기화 오류: 요청 타임아웃` 반복 (단, 연속 10회 실패 시 자동 정지 — `logs.md` 참조)
- `renew_sessions.py`가 매시 세션을 점검하지만, 판별 기준(`check_nitter()`)이 약하면 만료 상태에서도 "정상"으로 오판할 수 있음 → 기준은 트윗 본문(`tweet-content` 블록) 렌더 여부로 유지할 것
- 수동 갱신: `python3 /docker/nitter/create_session_curl.py <username> <password>` 로 새 쿠키 발급 후 `sessions.jsonl` 두 줄을 덮어쓰고 `docker compose restart nitter` 실행

### 포크 관련 메모
`unixfox/nitter` 같은 구버전 기반 포크는 sessions.jsonl을 아예 인식하지 못해 트윗 수집이 불가능합니다. 교체 시에는 바이너리에 sessions 처리 심볼이 있는지 확인할 것(예: `strings nitter | grep sessions.jsonl`).

---

## 활동 로그 시스템

관리자/봇의 모든 활동을 `logs` 테이블에 기록하고 관리자 페이지에서 조회.

### 로그 기록 방법

```js
import { logActivity } from '../utils/log.js';

// fire-and-forget: 로그 실패가 비즈니스 로직에 영향 주지 않음
logActivity(db, {
  actor: 'admin',              // "admin" 또는 봇 ID ("youtube-3", "x-1")
  action: 'create',            // create, update, delete, upload, start, stop, sync_complete, error
  category: 'album',           // album, schedule, member, bot, category, dict, concert, sync
  targetType: 'album',         // 대상 타입 (optional)
  targetId: 12,                // 대상 DB ID (optional)
  summary: '앨범 생성: 제목',   // 한 줄 요약
  details: { key: 'value' },   // 추가 정보 JSON (optional)
});
```

### 새 기능 추가 시
로그는 자동 수집이 아니므로, 새로운 라우트나 기능을 추가할 때 `logActivity` 호출을 직접 넣어야 합니다.

### 로그 대상
- **관리자 라우트**: 앨범/일정/멤버/봇/카테고리/사전/콘서트 CRUD
- **봇 스케줄러**: 동기화 완료(addedCount > 0), 동기화 에러
- **봇 서비스**: YouTube 영상 추가, X 트윗 추가

---

## 유용한 명령어

```bash
# 컨테이너 상태 확인
docker compose ps

# 완전 재시작
docker compose down && docker compose up -d --build

# Meilisearch 동기화
curl -X POST https://fromlog.caadiq.co.kr/api/schedules/sync-search \
  -H "Authorization: Bearer <token>"

# Redis 확인 (SCAN 사용 권장)
docker exec fromlog-redis redis-cli SCAN 0 MATCH "*" COUNT 100
```

## 쓰기 후 캐시 무효화

React Query 기본값이 `staleTime: 5분` · `refetchOnWindowFocus: false`(`frontend/src/main.jsx`)라,
어느 화면에서 데이터를 바꾼 뒤 다른 화면으로 **이동만 하면 최대 5분간 낡은 캐시**를 본다.

종전에는 폼이 `sessionStorage`에 토스트를 넣고 목록으로 이동하면, 목록이 그 토스트를 보고
`['adminSchedules']`만 무효화했다(`Schedules.jsx`). 두 가지가 샜다.

1. 토스트를 안 쓰는 경로(수집 큐 등록 후 '← 일정 관리')는 **아무도 무효화하지 않았다**
2. 토스트를 쓰더라도 공개 달력·일정 상세·검색 결과는 낡은 채였다.
   특히 상세(`['schedule', id]`)는 **수정 폼의 초기값**이라, 고친 직후 다시 열면 수정 전 값이
   채워지고 그대로 저장하면 방금 수정이 되돌아갔다

그래서 무효화는 화면 이동이 아니라 **쓰기가 일어난 자리**에 붙인다.
일정을 건드렸으면 `frontend/src/utils/invalidate.js`의 헬퍼를 부르면 된다.

```js
import { invalidateSchedules } from '@/utils';

const queryClient = useQueryClient();
// ... 저장/삭제 성공 직후, navigate 전에
invalidateSchedules(queryClient);
```

접두사로 걸리므로 연·월이나 id를 몰라도 되고, 관리자 목록·공개 달력·상세·검색이 한 번에 갱신된다.

### 서버 캐시도 같이 봐야 한다

월별 일정은 Redis에도 캐시된다(`schedule:monthly:*`, TTL 60초). 무효화는
`syncScheduleById(meilisearch, db, id, redis)`의 **네 번째 인자 redis가 있을 때만** 동작한다
(`services/meilisearch/index.js`의 `invalidateMonthlyCache`). redis를 빼먹으면 프론트가 다시
요청해도 서버가 낡은 JSON을 그대로 돌려준다 — 실제로 수집 큐 등록 경로가 그랬다.
새 생성 경로를 만들 때 **redis를 반드시 넘길 것**.

### YouTube 필터·중복 처리 정책 (2026-09-18)

- 배포 전 `backend/sql/youtube-filter-policy.sql`을 MariaDB에 적용한다(재실행 가능). 새 필드는 `description_filters`, `filter_mode`, `min_duration_seconds`이며 `youtube_bot_processed`는 일정 존재 여부와 별도로 봇의 후속 처리 완료를 기록한다.
- 새 봇은 `split`: 제목 키워드는 제목만, 설명 키워드는 설명만 검사한다. 한 필드 안은 OR, 두 필드 사이는 AND. 기존 봇은 `legacy`로 제목+설명 OR 및 연결 본편 폴백을 유지한다. 관리자 화면에서 제목/설명 필터를 변경하거나 전환 버튼을 누르면 `split`으로 바뀐다.
- 최소 길이는 일반 영상에만 적용한다. 쇼츠 설정은 독립적이며, 길이 0/미조회는 제외 캐시에 넣지 않고 재시도한다. 필터/길이 미달 영상은 X 링크 경로에서 별도 수집될 수 있다.
- X는 관리 채널도 일정·아카이브를 수집한다. 구 `exclude_managed_channels`는 더 이상 수집을 막지 않는다. 이미 저장된 트윗도 미완료 YouTube 링크를 다시 확인한다.
- 채널별 MariaDB advisory lock으로 X/YouTube 동시 쓰기를 직렬화한다. 잠금 대기 작업은 프로세스 내 3개로 제한하여 DB 풀을 고갈시키지 않는다. 영상 ID UNIQUE와 예정 존재 확인을 함께 사용한다.
- 봇은 X가 먼저 등록한 영상도 아카이브 저장, 중복 예정 정리, 다음 예정 생성, 검색 갱신을 수행한 뒤 완료를 기록한다. 필터와 길이를 통과한 당일 일반 영상만 주간 수집 종료 조건이다. 설정 변경 시 제외·완료 기록을 비워 재평가한다.
- 회차는 저장된 본편 제목의 EP.1/EP1/Episode 1/1화/제1화/1회 등을 읽는다. `episodeMatch`와 제목 필터·최소 길이로 범위를 좁히고 명시된 시즌을 분리한다. 영상 수 및 `episodeOffset`은 사용하지 않는다. 최신 대상 회차가 모호하면 번호 없는 `(예정)` 제목을 만든다.
- 회귀 검증: `cd backend && npm run test:youtube`.
- 이번 방판소녀들 보정: `node scripts/repair-bangpan-20260917.mjs`로 미리보기, `--apply`로 적용. 변경 전 스냅샷은 `backend/backups/`에 보관한다. 제목 `방판소녀들 시즌2`, 최소 300초, 본편 `Am4EJN0uF3Q`(EP.02), 9/24 예정 EP.3. 예고편 일정은 별도 유지한다.

### 앱 YouTube 플레이어 외부 링크 처리 (2026-09-19)

공통 `YoutubeController`에서 HTML을 로드하기 전에 `NavigationDelegate`를 등록한다. 플레이어의 제목·YouTube에서 보기·채널 링크는 웹뷰 이동을 막고 `url_launcher`의 `externalNonBrowserApplication`으로 연다. 앱 실행 실패 시 `externalApplication`으로 외부 브라우저를 사용한다. 임베드(`/embed/`), IFrame API, 재생 리소스 및 초기 문서는 그대로 허용한다. 외부 이동 전 플레이어를 일시정지하며 중복 실행 요청을 방지한다.

- 적용 범위: 일정 상세, 앨범 트랙, 응원법 등 공통 플레이어 사용 화면.
- 검증: `flutter test --no-pub test/youtube_links_test.dart`(6개), `flutter analyze --no-pub lib/widgets/youtube test/youtube_links_test.dart`.
- Android 확인 항목: 제목/채널/YouTube 로고 탭 → 외부 앱, 앱 미설치 시 외부 브라우저, 복귀 후 플레이어 유지, 재생·탐색·전체화면 정상 동작. 실기기 탭 검증은 별도 필요하다.
- APK 빌드: `flutter build apk --release --no-pub --target-platform android-arm64 --build-name=2.0.0 --build-number=2131`. 앱 코드 변경이므로 기존 설치본에는 APK 업데이트가 필요하다.

2026-09-19 Otto 발행 완료: `2.0.0+131`(Android versionCode `2131`). `otto-publish`로 arm64 split APK를 빌드·등록했고, 이전 버전 조회 200/현재 버전 조회 204 및 다운로드 APK의 SHA-256 일치를 확인했다. 휴대폰에서 앱을 다시 실행하면 업데이트 안내가 표시된다.

### 모바일 관리자 로그인·홈 (2026-09-23)

- 1100px 미만에서 `/admin`과 `/admin/dashboard`만 모바일 전용 레이아웃으로 표시한다. PC와 나머지 관리자 URL은 기존 페이지를 유지한다. 앱 변경 없음.
- 로그인은 기존 비밀번호/Google 인증·세션 저장을 재사용한다. Google 버튼은 모바일 컨테이너 폭에 맞춘다.
- 홈: 실제 대기 건수(`/admin/pending/count`), 전체 등록 일정(`/stats`), 최근 활동 4건(`/admin/logs`)과 빈 상태·조회 오류 표시. 별도 새로고침 버튼은 두지 않는다.
- 하단 네비게이션 없이 상단 메뉴 버튼으로 사이드 메뉴를 연다. 왼쪽 슬라이드 애니메이션(열기 240ms/닫기 180ms)을 적용하고 동작 줄이기 설정에서는 생략한다. Escape·배경·브라우저 뒤로가기로 닫을 수 있고, 로그아웃 시 관리자 쿼리 캐시를 제거한다. 사이트로 이동은 홈 본문 대신 사이드 메뉴 하단에 배치한다.
- 일정·큐·고정 링크·로그·테마·영상·봇 메뉴는 현재 기존 PC 관리 화면으로 연결됨을 표시한다. 큐 목록 및 등록 폼 모바일화, 포스터 다이얼로그는 후속 범위다. 큐에 카테고리 탭/필터/배지를 넣지 않는 사용자 합의 유지.
- 검증: dev 브라우저의 모의 API 응답으로 로그인 성공/실패·비밀번호 표시·세션 만료·새로고침·로그아웃·320/390px 폭·빈 목록·조회 오류·긴 로그·메뉴 이동/뒤로가기 확인. 실제 Google 계정 로그인과 실제 관리자 비밀번호 제출은 수행하지 않는다.
- dev에서 먼저 검토하며 운영 프론트엔드 배포는 별도 반영 요청 후 진행한다.

#### 모바일 관리자 사이드 메뉴·스크롤 수정

- 네이티브 dialog 자체에 유지되는 Web Animations transform 대신, 전체 화면 dialog 내부 패널과 배경에 상태별 CSS 애니메이션을 적용한다. 배경도 같은 시간 동안 페이드하며 패널 퇴장 완료 후 dialog를 닫는다.
- 관리자 홈은 높이 고정 flex 레이아웃으로 헤더와 본문 스크롤을 분리한다. html/body·본문·메뉴 스크롤에 overscroll-behavior:none을 적용해 페이지 전체의 경계 바운스를 차단하고, 다른 페이지로 이동할 때 루트 클래스는 해제한다.
- dev Chromium에서 모의 인증/조회 응답으로 반복 열기·닫기 15회(진입 중 닫기 포함), 배경 중간 투명도, Escape·배경 클릭·뒤로가기, 동작 줄이기 3회, 320px 화면, 본문 스크롤/헤더 위치/경계 CSS와 사이트 이동 후 정리를 확인했다. 실제 휴대폰의 네이티브 바운스는 사용자 기기에서 최종 확인 필요.

### 모바일 수집 큐 목록 (2026-09-23)

- `/admin/schedule/queue`에 모바일 전용 조회 목록을 추가했다. 기존 `GET /admin/pending` 응답을 사용하며 등록·무시·수정 요청은 하지 않는다. 최초 목록 구현 단계의 범위이며, 이후 무시 기능은 아래 후속 변경에서 연결했다. 등록 폼은 후속 작업이다.
- 카테고리 탭·필터·배지 없이 시안의 왼쪽 날짜 박스(월.일/요일), 오른쪽 제목·시간, 하단 무시/검토 후 등록 버튼 배치를 유지한다. 목록 단계이므로 두 버튼은 비활성 상태다. 장소·멤버·설명은 목록에 펼치지 않고 검색 대상으로만 사용한다. 중복 의심, 최신 원문에서 사라짐, 등록 미완료 표시는 유지한다.
- 제목·장소·설명·날짜·멤버 검색, 검색 초기화, 날짜/시간 미정, 빈 큐·검색 결과 없음·조회 오류/재시도 상태를 제공한다.
- `pages/mobile/admin/Layout.jsx`로 홈의 인증 확인·사이드 메뉴·본문 스크롤을 공유한다. 홈/큐 사이드 메뉴의 현재 위치를 표시한다.
- dev Chromium 모의 API 응답으로 목록/검색/빈 상태/오류 복구/긴 제목/320px/메뉴를 확인하고, 변경 요청이 발생하지 않는 것을 검증했다. 프론트엔드 빌드 통과. 운영 배포는 별도 요청 후 진행한다.


#### 수집 큐 날짜·태그 및 무시 처리 후속

- 사용자 최신 요청에 따라 날짜 박스를 60×60px 정사각형으로 변경하고 시간 앞에 카테고리 태그를 복원했다. 카테고리 탭·필터는 추가하지 않는다. 제목과 태그/시간 간격은 4px이다.
- 무시 버튼 → 공통 ConfirmDialog → `POST /admin/pending/:id/dismiss`로 연결한다. 서버 성공 후 목록에서 제거하고 모바일 홈/사이드 메뉴 및 기존 큐 대기 건수·활동 로그 캐시를 갱신한다.
- 처리 중 중복 요청 방지, 실패 시 항목·다이얼로그 유지 및 재시도 지원. 이미 일정이 생성된 항목은 서버 정책과 동일하게 무시 불가. 검토 후 등록 버튼은 여전히 비활성이다.
- dev 브라우저의 모의 응답으로 확인/취소/뒤로가기, 오류·재시도, 성공 후 목록/건수 갱신, 320px과 날짜 박스 크기를 검증한다. 검증 목적으로 실제 대기 일정을 무시하지 않는다.
