# 개발/배포 가이드

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

## YouTube 봇 동기화

### 동기화 흐름 (syncNewVideos)
1. `fetchRecentUploads()` — Activities API로 최근 업로드 조회 (1 unit).
   **snippet(제목·설명)이 함께 오므로 그대로 반환** — 제목 필터를 추가 API 호출 없이 적용
2. 이미 저장된 것(`schedule_youtube`) + 이전에 거부된 것(`youtube_skipped_videos`) 제외
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
