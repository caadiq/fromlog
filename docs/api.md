# API 명세

Base URL: `/api`

## 인증

### POST /auth/login
로그인 (JWT 토큰 발급)

**Rate Limit:** 1분당 5회 (IP 기준)

### GET /auth/verify
토큰 검증 및 사용자 정보 (인증 필요)

---

## 멤버

### GET /members
멤버 목록 조회

### GET /members/:name
멤버 상세 조회

**Parameters:**
- `name` - 멤버 이름 (한글 또는 영문, 대소문자 무관)

**예시:**
- `/members/박지원` - 한글명으로 조회
- `/members/jiwon` - 영문명으로 조회

---

## 앨범

### GET /albums
앨범 목록 조회

### GET /albums/:id
앨범 상세 조회

### PUT /albums/:albumId/photos/bulk-update (관리자)
등록된 컨셉 포토의 순서·타입·컨셉명·멤버 일괄 수정.
body: `{ photos: [{ id, sort_order, photo_type, concept_name, members }] }`
관리자 사진 관리 탭의 편집 리스트(드래그 정렬·번호 이동·메타 편집)가 사용.

### GET /albums/photos/x-image?scheduleId=&index= (관리자)
X 게시물 일정의 이미지를 원본 화질(name=orig)로 프록시 스트림.
(pbs.twimg.com CORS 우회용) 관리자 사진 관리의 "일정에서 가져오기"가
이 프록시로 이미지를 받아 **업로드 대기 목록에 추가**하고, 순서·컨셉·
멤버 편집 후 기존 업로드 API로 저장한다. `X-Image-Count` 헤더로
해당 일정의 총 이미지 수 반환.

### GET /albums/hero
홈 히어로 슬라이드(리뉴얼) — 최신 앨범의 세로형 컨셉 포토 목록.
응답: `{ album:{id,title,folderName,releaseDate}, photos:[mediumUrl], fit:'contain'|'crop' }`
폴백: 세로형 없음 → 전체 포토(crop) → 커버.

### POST /albums (관리자)
앨범 생성 (multipart: `data` JSON + `cover` 이미지).
생성 시 **발매 일정이 자동 생성**됨 — `{album_type} '{title}' 발매`,
날짜=release_date, 시간 없음, 카테고리 '앨범'(id 17), `schedule_album`으로 연결.
일정 목록/상세 응답에 `albumFolder`가 포함되며, 프론트(웹/앱)는 이 값이 있으면
일정 상세 대신 앨범 상세(`/album/{albumFolder}`)로 이동한다.
앨범 수정/삭제 시 일정은 연동되지 않음(일정 관리에서 직접 수정).
커버 업로드 시 **대표색을 sharp로 추출**해 정규화한 hex를 `albums.theme_color`에 저장(동적 테마용).

---

## 테마 컬러 (동적)

프론트(웹·앱)의 primary 색을 **커버가 있는 최신 앨범의 대표색**으로 자동 적용한다.
가독성을 위해 명도·채도를 보정하고 `{primary, soft, deep}` 팔레트를 파생한다.
- 웹: `:root` CSS 변수 `--c-primary/-soft/-deep`(RGB 채널)로 주입(`src/theme`), Tailwind `primary`/`green-soft`/`green-deep` 토큰이 이를 참조.
- 앱: 시작 시 `loadPalette()`가 `appPalette`(constants.dart) 갱신.

### GET /theme
현재 적용 팔레트(공개). 응답: `{ mode, source:'auto'|'manual'|'default', primary, soft, deep, albumId? }`
- manual 모드+수동색 → 수동색, 아니면 `theme_color`와 커버가 있는 최신 앨범색, 없으면 브랜드 그린.

### GET /admin/theme (관리자)
설정 + 미리보기. 응답: `{ mode, manualColor, manualPalette, autoPalette, autoAlbum{id,title,coverThumbUrl,themeColor}, resolved }`

### PUT /admin/theme (관리자)
`{ mode:'auto'|'manual', manualColor?:'#RRGGBB' }` 저장. manual이면 색상 필수. `logActivity(settings/theme)`.

### POST /admin/theme/reextract (관리자)
커버 있는 앨범의 대표색 재추출(백필). body `{ all?:boolean }`(all=false면 `theme_color`가 없는 것만). 응답 `{ total, updated, failed[] }`.

---

## 일정

### GET /schedules
일정 조회

**Query Parameters:**
- `year`, `month` - 월별 조회
- `startDate` - 시작 날짜 (YYYY-MM-DD), 다가오는 일정 조회
- `search` - 검색어 (Meilisearch 사용)
- `offset`, `limit` - 페이징

※ `search`, `startDate`, `year/month` 중 하나는 필수

**월별 조회 응답:**
```json
{
  "schedules": [
    {
      "id": 123,
      "title": "...",
      "date": "2026-01-18",
      "time": "19:00:00",
      "category": { "id": 2, "name": "유튜브", "color": "#ff0033" },
      "source": {
        "name": "fromis_9",
        "url": "https://www.youtube.com/watch?v=VIDEO_ID"
      },
    }
  ]
}
```

**특수 일정 ID 형식:**
- 생일: `birthday-{year}-{nameEn}` (예: `birthday-2026-jiwon`)
- 데뷔: `debut-{year}` (예: `debut-2018`)
- 주년: `anniversary-{year}` (예: `anniversary-2026`)
※ `time`: 시간이 없는 일정은 `null`, 00:00 시간은 `"00:00:00"`으로 반환
```

**source 객체 (카테고리별):**
- YouTube (category_id=2): `{ name: "채널명", url: "https://www.youtube.com/..." }`
- X (category_id=3): `{ name: "", url: "https://x.com/realfromis_9/status/..." }` (name 빈 문자열)
- 기타 카테고리: source 없음

**다가오는 일정 응답 (startDate):**
```json
{
  "schedules": [
    {
      "id": 123,
      "title": "...",
      "date": "2026-01-18",
      "time": "19:00:00",
      "category": { "id": 2, "name": "유튜브", "color": "#ff0033" },
      "source": { "name": "fromis_9", "url": "https://..." },
    }
  ]
}
```
※ `time`: 시간이 없는 일정은 `null`, 00:00 시간은 `"00:00:00"`으로 반환

**검색 응답:**
```json
{
  "schedules": [
    {
      "id": 123,
      "title": "...",
      "date": "2026-01-18",
      "time": "19:00:00",
      "category": { "id": 2, "name": "유튜브", "color": "#ff0033" },
      "source": { "name": "fromis_9", "url": "https://..." },
      "_rankingScore": 0.95
    }
  ],
  "total": 100,
  "offset": 0,
  "limit": 20,
  "hasMore": true
}
```
※ `time`: 시간이 없는 일정은 `null`, 00:00 시간은 `"00:00:00"`으로 반환
```

### GET /schedules/categories
카테고리 목록 조회

**응답:**
```json
[
  { "id": 1, "name": "기타", "color": "#gray", "sort_order": 0 },
  { "id": 2, "name": "유튜브", "color": "#ff0033", "sort_order": 1 }
]
```

### GET /schedules/:id
일정 상세 조회

### DELETE /schedules/:id
일정 삭제 (인증 필요)

### POST /schedules/sync-search
Meilisearch 전체 동기화 (인증 필요)

---

## 추천 검색어

### GET /schedules/suggestions
추천 검색어 조회

**Query Parameters:**
- `q` - 검색어 (2자 이상)
- `limit` - 결과 개수 (기본 10)

**응답:**
```json
{
  "suggestions": ["송하영", "송하영 직캠", "하영"]
}
```

### GET /schedules/suggestions/popular
인기 검색어 조회

**Query Parameters:**
- `limit` - 결과 개수 (기본 10)

**응답:**
```json
{
  "queries": ["프로미스나인", "송하영", "이서연"]
}
```

### POST /schedules/suggestions/save
검색어 저장 (검색 실행 시 호출)

**Request Body:**
```json
{
  "query": "검색어"
}
```

### GET /schedules/suggestions/dict
사용자 사전 조회 (인증 필요)

**응답:**
```json
{
  "content": "프로미스나인\t프로미스나인\tNNP\n..."
}
```

### PUT /schedules/suggestions/dict
사용자 사전 저장 (인증 필요)

**Request Body:**
```json
{
  "content": "프로미스나인\t프로미스나인\tNNP\n..."
}
```

---

## 관리자 - 봇 관리 (인증 필요)

### GET /admin/bots
봇 목록 조회

**응답:**
```json
[
  {
    "id": "youtube-fromis9",
    "name": "fromis_9",
    "type": "youtube",
    "status": "running",
    "last_check_at": "2026-01-18T19:30:00+09:00",
    "last_added_count": 2,
    "last_sync_duration": 1234,
    "schedules_added": 150,
    "check_interval": 2,
    "error_message": null,
    "enabled": true
  },
  {
    "id": "meilisearch-sync",
    "name": "Meilisearch 동기화",
    "type": "meilisearch",
    "status": "running",
    "last_check_at": "2026-01-18T04:00:00+09:00",
    "last_added_count": 500,
    "last_sync_duration": 2500,
    "schedules_added": 500,
    "check_interval": 0,
    "error_message": null,
    "enabled": true,
    "version": "1.6.0"
  }
]
```

**필드 설명:**
- `type`: `youtube` | `x` | `festival` | `meilisearch`
- `last_check_at`: 마지막 동기화 시간 (KST, +09:00)
- `last_sync_duration`: 마지막 동기화 소요 시간 (ms)
- `version`: Meilisearch 버전 (meilisearch 타입만)

### POST /admin/bots/:id/start
봇 시작

### POST /admin/bots/:id/stop
봇 정지

### POST /admin/bots/:id/sync-all
전체 동기화 (모든 영상/트윗 수집)

**응답:**
```json
{
  "success": true,
  "addedCount": 25,
  "total": 100
}
```

### GET /admin/bots/quota-warning
YouTube API 할당량 경고 조회

**응답:**
```json
{
  "active": true,
  "message": "YouTube API 할당량 초과",
  "timestamp": "2026-01-18T19:00:00+09:00"
}
```

### DELETE /admin/bots/quota-warning
할당량 경고 해제

---

## 관리자 - YouTube 봇 (인증 필요)

### POST /admin/youtube-bots/lookup
채널 핸들로 채널 정보 조회

**Request Body:**
```json
{
  "handle": "@studiofromis_9"
}
```

**응답:**
```json
{
  "channelId": "UCxxx",
  "title": "채널명",
  "thumbnailUrl": "https://...",
  "bannerUrl": "https://..."
}
```

### GET /admin/youtube-bots
YouTube 봇 목록 조회

### GET /admin/youtube-bots/:id
YouTube 봇 상세 조회

### POST /admin/youtube-bots
YouTube 봇 추가

**Request Body:**
```json
{
  "channel_id": "UCxxx",
  "channel_handle": "@studiofromis_9",
  "channel_name": "채널명",
  "cron_interval": 2,
  "title_filters": ["fromis_9", "프로미스나인"],
  "exclude_shorts": false,
  "auto_schedule_config": {
    "dayOfWeek": 4,
    "time": "18:00:00",
    "titleTemplate": "{channelName} {episode}화",
    "deadlineDayOfWeek": 5
  },
  "weekly_schedule_config": {
    "dayOfWeek": 3,
    "startTime": "19:00",
    "intervalSeconds": 30,
    "durationMinutes": 30
  }
}
```

**폴링 방식:**
- `cron_interval` (분): 상시 폴링. `weekly_schedule_config`가 null이면 이 값 사용
- `weekly_schedule_config`: 지정 요일/시각에만 집중 폴링. 값이 있으면 `cron_interval`은 무시(서버에서 null로 저장). 당일 게시된 일반 영상 저장 시 즉시 종료(stopOnFound — 백로그 영상은 종료 조건 아님), `durationMinutes` 초과 시에도 종료

### PUT /admin/youtube-bots/:id
YouTube 봇 수정

### DELETE /admin/youtube-bots/:id
YouTube 봇 삭제

---

## 관리자 - X 봇 (인증 필요)

### POST /admin/x-bots/lookup
X username으로 프로필 정보 조회 (Nitter 사용)

**Request Body:**
```json
{
  "username": "realfromis_9"
}
```

**응답:**
```json
{
  "username": "realfromis_9",
  "displayName": "프로미스나인 (fromis_9)",
  "avatarUrl": "https://..."
}
```

### GET /admin/x-bots
X 봇 목록 조회

**응답:** `XBot[]`

### GET /admin/x-bots/:id
X 봇 상세 조회

**응답:**
```json
{
  "id": 1,
  "username": "realfromis_9",
  "display_name": "프로미스나인 (fromis_9)",
  "avatar_url": "https://...",
  "text_filters": ["fromis", "프로미스"],
  "include_retweets": false,
  "extract_youtube": true,
  "cron_interval": 1,
  "enabled": true
}
```

### POST /admin/x-bots
X 봇 추가

**Request Body:**
```json
{
  "username": "realfromis_9",
  "display_name": "프로미스나인 (fromis_9)",
  "avatar_url": "https://...",
  "text_filters": ["fromis"],
  "include_retweets": false,
  "extract_youtube": false,
  "cron_interval": 1
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `username` | string | (필수) | X username (@ 없이) |
| `display_name` | string\|null | null | 표시 이름 |
| `avatar_url` | string\|null | null | 프로필 이미지 URL |
| `text_filters` | string[]\|null | null | 텍스트 필터 (하나라도 포함 시 추가, 비어있으면 모든 트윗) |
| `include_retweets` | boolean | false | 리트윗 포함 여부 |
| `extract_youtube` | boolean | false | 트윗 내 YouTube 링크 자동 추출하여 유튜브 일정 추가 |
| `exclude_managed_channels` | boolean | true | `extract_youtube`가 true일 때, 등록된 YouTube 봇 채널의 영상은 중복 추가에서 제외 |
| `cron_interval` | integer | 1 | 동기화 간격 (분) |

### PUT /admin/x-bots/:id
X 봇 수정 (부분 업데이트 가능)

### DELETE /admin/x-bots/:id
X 봇 삭제

---

## 관리자 - 일정 수집 봇 (구 축제 봇, 인증 필요)

DC 갤러리 "앞으로 일정" 최신 글을 긁어 Gemini로 구조화·카테고리 분류·기존 일정 중복판단한 뒤,
신규 일정 후보를 **검토 큐(`bot_pending_schedules`)에 적재**하고 관리자에게 FCM 푸시로 알린다.
**자동 등록하지 않는다** — 관리자가 "큐 관리"에서 검토 후 등록한다. (구 memogipost 블로그 `url_context` 방식 폐기)

- 최신 글 1개만 파싱(향후 일정이 누적됨). 이미 처리한 글은 `festival_crawl_log`로 건너뜀(멱등)
- Gemini가 카테고리(유튜브/예능/콘서트/행사/팬사인회/티켓팅/기타) 분류 + 기존 일정 대비 중복판단
- 큐 dedup: `dedup_key`(date+정규화 title) 유니크로 재적재/무시항목 재등장 방지
- 봇 실행/스케줄은 기존 축제 봇 인프라 재사용(`bot_festival`, `festivalBot.syncNewFestivals`).
  `bot_festival.search_url`에 DC 검색 목록 URL을 저장
- 스케줄러 반환 `{ addedCount, total }` — addedCount=큐 신규 적재 건수

관리자 큐 API는 [관리자 - 수집 큐](#관리자---수집-큐-인증-필요) 참고.

### GET /admin/festival-bots
축제 봇 목록 조회

**응답:** `FestivalBot[]`

### GET /admin/festival-bots/:id
축제 봇 상세 조회

**응답:**
```json
{
  "id": 1,
  "name": "축제 봇",
  "search_url": "https://memogipost.tistory.com/search/프로미스나인",
  "cron_interval": 360,
  "enabled": true
}
```

### POST /admin/festival-bots
축제 봇 추가

**Request Body:**
```json
{
  "name": "축제 봇",
  "search_url": "https://memogipost.tistory.com/search/프로미스나인",
  "cron_interval": 360
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `name` | string | (필수) | 봇 이름 |
| `search_url` | string | (필수) | 크롤링할 검색 페이지 URL |
| `cron_interval` | integer | 360 | 동기화 간격 (분). 60 이상은 시간 단위 cron으로 변환 |

### PUT /admin/festival-bots/:id
축제 봇 수정 (부분 업데이트 가능)

### DELETE /admin/festival-bots/:id
축제 봇 삭제

---

## 관리자 - YouTube (인증 필요)

### GET /admin/youtube/video-info
YouTube 영상 정보 조회

**Query Parameters:**
- `url` - YouTube URL (watch, shorts, youtu.be 모두 지원)

**응답:**
```json
{
  "videoId": "abc123",
  "title": "영상 제목",
  "channelId": "UCxxx",
  "channelName": "채널명",
  "date": "2026-01-19",
  "time": "15:00:00",
  "videoType": "video",
  "videoUrl": "https://www.youtube.com/watch?v=abc123"
}
```

### GET /admin/ticketing/series (관리자)
티켓팅 연결용 콘서트 시리즈 목록. 응답: `[{ id, title }]`

### POST /admin/ticketing (관리자)

`presaleEnd`(선예매 종료, `YYYY-MM-DD HH:MM`)는 선택 — 선예매·일반예매 두 행에 함께 저장되어
어느 쪽 상세에서도 선예매가 기간으로 표시된다.
티켓팅 일정 세트 생성 — 선예매·일반예매 중 입력된 단계마다 일정이 하나씩 생성된다.
제목은 `"{eventName} 선예매"` / `"{eventName} 일반예매"`로 자동 구성.
두 단계 모두 생성 시 `schedule_ticketing.pair_schedule_id`로 상호 참조된다.

**Request Body:**
```json
{
  "eventName": "2025 fromis_9 WORLD TOUR IN SEOUL 티켓 오픈",
  "vendor": "멜론티켓",
  "ticketUrl": "https://ticket.melon.com/...",
  "seriesId": 3,
  "presale": { "date": "2025-07-08", "time": "20:00", "purchaseLimit": "1인 1매 (회차별)" },
  "general": { "date": "2025-07-09", "time": "20:00", "purchaseLimit": "1인 2매 (선예매 포함 최대 4매)" },
  "authStart": "2025-07-02 12:00:00",
  "authEnd": "2025-07-08 23:59:00",
  "authNote": "flover 2025 MEMBERSHIP",
  "postUrls": ["https://x.com/..."]
}
```
- `seriesId`: 콘서트 시리즈 연결 (선택 — 팬미팅 등은 null)
- `presale`/`general`: 하나 이상 필수. 매수 제한은 단계별
- `authStart/End/Note`: 팬클럽 인증 기간 (선택, 선예매 조건)

**Response:** `{ "success": true, "scheduleIds": [3385, 3386] }`

### PUT /admin/ticketing/:id (관리자)
티켓팅 단건 수정. body: `{ title, date, time, vendor, ticketUrl, seriesId, purchaseLimit, authStart, authEnd, authNote, postUrls }`

**일정 상세 응답 (티켓팅, category_id=7):**
`stage`('presale'|'general'), `vendor`, `ticketUrl`, `purchaseLimit`,
`authStart`/`authEnd`(벽시계 'YYYY-MM-DD HH:mm')/`authNote`, `postUrls`,
`pair`(세트 상대: scheduleId·stage·date·time),
`concert`(연결 시: seriesId·title·posterThumbUrl·startDate·endDate·venueName·firstScheduleId)

### POST /admin/youtube/schedule
YouTube 일정 저장

**Request Body:**
```json
{
  "videoId": "abc123",
  "title": "영상 제목",
  "channelId": "UCxxx",
  "channelName": "채널명",
  "date": "2026-01-19",
  "time": "15:00:00",
  "videoType": "video"
}
```

### PUT /admin/youtube/schedule/:id
YouTube 일정 수정 (영상 유형)

**Request Body:**
```json
{
  "memberIds": [1, 2, 3],
  "videoType": "video"
}
```
※ `videoType`: "video" 또는 "shorts"

---

## 관리자 - X (인증 필요)

### GET /admin/x/post-info
X 게시글 정보 조회 (Nitter 스크래핑)

**Query Parameters:**
- `postId` - 게시글 ID (필수)
- `username` - 사용자명 (기본: realfromis_9)

**응답:**
```json
{
  "postId": "1234567890",
  "username": "realfromis_9",
  "text": "게시글 전체 내용",
  "title": "첫 문단 (자동 추출)",
  "imageUrls": ["https://pbs.twimg.com/media/..."],
  "date": "2026-01-19",
  "time": "15:00:00",
  "postUrl": "https://x.com/realfromis_9/status/1234567890",
  "profile": {
    "displayName": "프로미스나인 (fromis_9)",
    "avatarUrl": "https://..."
  }
}
```

### POST /admin/x/schedule
X 일정 저장

**Request Body:**
```json
{
  "postId": "1234567890",
  "title": "게시글 제목",
  "content": "게시글 내용",
  "imageUrls": ["https://..."],
  "date": "2026-01-19",
  "time": "15:00:00"
}
```

---

## 관리자 - 행사 (인증 필요)

### GET /admin/events/:id
행사 상세 조회 (수정 폼용)

**응답:**
```json
{
  "id": 2565,
  "title": "2026 UNION : PAINT THE UNION🎨",
  "date": "2026-05-07",
  "time": "21:30",
  "subtype": "university",
  "schoolName": "인천대학교",
  "memberIds": [1, 2, 3, 4, 5],
  "venue": {
    "id": 1,
    "name": "인천대학교",
    "address": "...",
    "roadAddress": "...",
    "lat": 37.xxx,
    "lng": 126.xxx,
    "kakao_id": null
  },
  "postUrls": ["https://www.instagram.com/p/..."],
  "posters": [
    { "id": 10001, "originalUrl": "...", "mediumUrl": "...", "thumbUrl": "..." }
  ]
}
```

### POST /admin/events
행사 생성 (`multipart/form-data`)

**multipart 파트:**
- `payload` (JSON string): `{ subtype, title, schoolName, date, time, memberIds, venue, postUrls }`
  - `subtype`: 현재 `'university'`만 지원
  - `venue`: `{ name, address, roadAddress?, lat, lng, kakao_id? }` — kakao_id 기준으로 event_venues 테이블에 upsert
  - `title`, `schoolName`, `date`, `venue` 필수
- `posters` (파일, 0개 이상): 포스터 이미지. 여러 장 가능

**응답:** `{ "id": 2565 }`

### PUT /admin/events/:id
행사 수정 (`multipart/form-data`)

**multipart 파트:**
- `payload` (JSON string): 위 POST 필드 + `keepPosterIds: number[]` (유지할 기존 포스터 ID 순서대로)
- `posters` (파일, 0개 이상): 새로 추가할 포스터

서버는 `keepPosterIds` 다음에 새 파일 id들을 이어붙여 `poster_image_ids` 업데이트.

### DELETE /admin/events/:id
행사 삭제 (schedules CASCADE로 schedule_event도 정리)

---

## 관리자 - 기타 (인증 필요)

기타(카테고리 1)는 라디오·뮤지컬 등 기존 카테고리에 안 맞는 단발 출연을 담는 **공용 카테고리**.
`schedule_etc`(venue_id, description, post_urls, poster_image_ids)에 1:1 저장. 장소·포스터·설명 모두 선택.
행사(events)와 대칭 구조이나 subtype·school_name이 없고 `description`(자유 텍스트)이 있으며 장소가 선택이다.

### GET /admin/etc/:id
기타 상세 조회 (수정 폼용)

**응답:**
```json
{
  "id": 3745,
  "title": "뮤지컬 <헬스키친> - 박지원 출연",
  "date": "2026-07-28",
  "time": "19:30",
  "description": "뮤지컬 <헬스키친>\n박지원 - 앨리(ALI) 역",
  "venue": { "id": 25, "name": "GS아트센터", "address": "...", "roadAddress": "...", "lat": 37.xxx, "lng": 127.xxx, "kakao_id": "..." },
  "postUrls": [],
  "posters": [ { "id": 10001, "originalUrl": "...", "mediumUrl": "...", "thumbUrl": "..." } ]
}
```

### POST /admin/etc
기타 생성 (`multipart/form-data`)

**multipart 파트:**
- `payload` (JSON string): `{ title, date, time?, description?, venue?, postUrls? }`
  - `title`, `date` 필수. `venue`·`description`·`postUrls`·포스터는 모두 선택
  - `venue`: `{ name, address?, roadAddress?, lat?, lng?, kakao_id? }` — kakao_id 기준 event_venues upsert (행사와 테이블 공유)
- `posters` (파일, 0개 이상): 포스터 이미지

**응답:** `{ "id": 3745 }`

### PUT /admin/etc/:id
기타 수정 (`multipart/form-data`) — payload에 `keepPosterIds: number[]` 추가. 동작은 행사와 동일.

### DELETE /admin/etc/:id
기타 삭제 (schedules CASCADE로 schedule_etc도 정리). 관리자 목록의 범용 삭제(`DELETE /schedules/:id`)로도 정리됨.

---

## 관리자 - 수집 큐 (인증 필요)

DC봇이 적재한 신규 일정 후보(`bot_pending_schedules`)를 검토·등록·무시한다.

### GET /admin/pending
대기 목록. `?status=pending|registered|dismissed`(기본 pending).

**응답:** `{ items: [{ id, category, title, date, time, members[], venueName, description, status, ... }] }`

### GET /admin/pending/count
대기 건수 (배지용). **응답:** `{ count }`

### POST /admin/pending/:id/register
검토 후 등록 (수정된 값으로). **본문:** `{ category, title, date, time?, venueName?, description?, postUrls? }`
- `기타` → `schedule_etc`, `행사` → `schedule_event`(general)로 생성. `venueName`은 카카오로 지오코딩
- 그 외 카테고리는 400(`UNSUPPORTED_CATEGORY`) — 관리자 폼에서 직접 추가 후 무시
- 성공 시 큐 항목 `status='registered'`, `created_schedule_id` 연결. **응답:** `{ id }`(생성된 일정 id)

### POST /admin/pending/:id/dismiss
무시 처리 (`status='dismissed'`). **응답:** `{ success: true }`

---

## 관리자 - 팬사인회 (인증 필요)

팬사인회(카테고리 5)는 `schedule_fansign`(format, venue_id)에 1:1로 저장. JSON 본문.

### POST /admin/fansign
팬사인회 생성

**본문:** `{ title, date, time?, format, venue?, postUrls?, members? }`
- `format`: `'offline'`(대면) | `'online'`(영통). 기본 `'offline'`
- `venue`: `{ name, address?, lat?, lng?, kakao_id? }` — 대면일 때만 event_venues에 upsert. 영통이면 무시되어 NULL 저장
- `postUrls`: 출처 링크 문자열 배열 (위버스 공지·판매처 등). `schedule_fansign.post_urls`(JSON)에 저장
- `members`: 멤버 id 배열
- `title`, `date` 필수

**응답:** `{ "success": true, "scheduleId": 3201 }`

### PUT /admin/fansign/:id
팬사인회 수정 (본문은 POST와 동일, 멤버는 전체 교체)

### 삭제
별도 라우트 없이 공용 `DELETE /schedules/:id` 사용 (schedules CASCADE로 schedule_fansign 정리)

---

## 관리자 - 활동 로그 (인증 필요)

### GET /admin/logs
활동 로그 목록 조회

**Query Parameters:**
- `page` - 페이지 번호 (기본 1)
- `limit` - 페이지당 개수 (기본 50, 최대 100)
- `category` - 카테고리 필터 (콤마 구분: album, schedule, member, bot, category, dict, concert, sync)
- `actor` - 행위자 필터 (admin 또는 bot)
- `search` - summary 텍스트 검색
- `from` - 시작 날짜 (YYYY-MM-DD)
- `to` - 종료 날짜 (YYYY-MM-DD)

**응답:**
```json
{
  "logs": [
    {
      "id": 1,
      "actor": "admin",
      "action": "create",
      "category": "album",
      "target_type": "album",
      "target_id": 12,
      "summary": "앨범 생성: Unlock My World",
      "details": null,
      "created_at": "2026-03-02 14:30:00"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

**actor 값:**
- `"admin"` - 관리자 수동 작업
- `"youtube-{id}"` - YouTube 봇 (예: youtube-3)
- `"x-{id}"` - X 봇 (예: x-1)

**action 값:**
- `create`, `update`, `delete`, `upload` - CRUD 작업
- `start`, `stop` - 봇 시작/정지
- `sync_complete` - 봇 동기화 완료
- `error` - 봇 동기화 에러

---

## 헬스 체크

### GET /health
서버 상태 확인

---

## API 문서

### GET /docs
Scalar API Reference UI

### GET /docs/json
OpenAPI JSON 스펙

---

## 영상 아카이브 (videos)

일정과 분리된 영상 페이지 데이터원. 5인 체제(2025-01-26) 이후 콘텐츠만 담는다.

### GET /videos/home
영상 메인 화면 데이터.

**Response:** `{ featured, sections: {official|sp|variety|music: [...]}, shorts: [...], counts, labels }`
- `featured`: 본채널·스프·예능 · 기타 중 최신 일반 영상 (무대 · 퍼포먼스는 제외 — 같은 무대 직캠이 여러 편 올라와 메인을 계속 차지한다)
- `labels`: 카테고리별 표시 이름 — 단일 채널 카테고리는 실제 채널명, 복수 채널이면 null(프론트 기본 라벨)

### GET /videos
영상 전체보기 (필터·페이징).

**Query:** `category`(official|sp|variety|music) · `channel` · `member` · `shorts`(only|exclude) · `limit`(≤60) · `offset`
**Response:** `{ videos, total, offset, limit, hasMore, months: [{ym, count}], facets: {channels}, categoryLabel }`
- `facets.channels`: music·variety·shorts에서만 — 채널 드롭다운용
- 각 video의 `duration`: 영상 길이(초). 쇼츠는 채우지 않아 `null`이고, 라이브 스트림처럼
  길이를 못 받은 영상도 `null`. 프론트는 값이 있을 때만 썸네일 우하단에 배지를 그린다.
  쇼츠 판별용 `videos.list?part=contentDetails` 응답에 이미 들어 있어 추가 호출이 없다.

### GET /admin/videos (관리자)
아카이브 목록. Query: `category` · `channel` · `q`(제목 검색) · `type`(video|shorts) · `limit` · `offset`

### GET /admin/videos/preview?url= (관리자)
URL로 영상 정보 미리보기. 추천 카테고리(`suggestedCategory`), 중복(`alreadyExists`),
5인 체제 컷 위반(`beforeCutoff`)을 등록 전에 알려준다.

### POST /admin/videos (관리자)
영상 수동 등록. body: `{ "url": "...", "category": "variety" }` (category 생략 시 자동 판별)
설명란 없는 쇼츠처럼 봇이 못 잡는 영상용.

### PUT /admin/videos/:videoId (관리자)
카테고리·타입 수정. body: `{ "category": "music", "video_type": "shorts" }`

### DELETE /admin/videos/:videoId (관리자)
아카이브에서 삭제.

---

## 푸시 알림 (FCM)

### POST /push/register
앱 기기 토큰 등록·갱신. `adminKey`가 `PUSH_ADMIN_KEY`와 일치하면 운영 알림 수신 기기로 표시된다.

**Request Body:** `{ "token": "...", "platform": "android", "adminKey": "..." }`
**Response:** `{ "success": true, "isAdmin": true }`

### DELETE /push/register
토큰 해제. body: `{ "token": "..." }`

### POST /push/ops-alert (내부 전용)
운영 알림 발송. 헤더 `X-Internal-Key: {PUSH_INTERNAL_KEY}` 필요.

**Request Body:** `{ "title": "...", "body": "...", "data": {} }`
**Response:** `{ "success": true, "sent": 1, "failed": 0, "removed": 0 }`

### POST /push/test (관리자)
테스트 발송. 응답에 `pushAvailable`(Firebase 초기화 여부), `adminDevices`(대상 기기 수) 포함.

**발송 시점**
- **봇 자동 정지**: 연속 10회 실패로 정지될 때 (`scheduler.js`) — 원인을 분류해
  사유·조치와 함께 발송 (X 세션 만료 / 할당량 초과 / 네트워크 실패 등)
- **X 세션 갱신 실패**: `/docker/nitter/renew_sessions.py`가 매시 점검 후 실패 시
