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

### POST /albums/:albumId/photos (관리자)

컨셉 포토/티저 업로드. multipart `photos` 파일, `metadata` JSON 배열,
`photoType` (`concept`/`teaser`), 선택적인 `startNumber`를 받으며 SSE로 진행률과 결과를 반환한다.

- 각 업로드는 UUID 파일명을 사용한다. 이미지의 원본·800px·400px 변형은 같은 UUID의 `.webp`, 영상은 `.mp4`로 저장한다.
- DB의 `original_url`, `medium_url`, `thumb_url`, `video_url`이 실제 파일을 가리킨다. 별도 미디어 테이블 추가는 필요하지 않다.
- `startNumber`는 `sort_order`에만 적용된다. 생략하면 해당 컨셉 포토/티저 목록의 최대 순서 다음부터 시작한다.
- 같은 번호로 다시 업로드하거나 순서를 바꿔도 기존 파일을 덮어쓰지 않는다. 순서 변경은 파일 이름을 바꾸지 않는다.
- 기존 번호형 파일의 UUID 이전 절차는 [개발 가이드](development.md#앨범-미디어-uuid-이전)를 참고한다.

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

### PUT /albums/:id (관리자)
앨범 수정 (multipart: `data` JSON + 선택적인 `cover` 이미지).

- `data.tracks`의 기존 트랙은 조회 응답의 `id`를 유지해서 전달한다. 같은 ID를 UPDATE하므로 앨범 설명·커버·트랙 정보·순서를 수정해도 연결된 응원법과 공개 설정이 유지된다.
- ID가 없는 트랙은 새로 추가한다. 기존 트랙 중 전달된 배열에서 빠진 트랙만 삭제하며, **실제로 삭제한 트랙의 응원법은 DB CASCADE로 함께 삭제**된다.
- `tracks` 필드를 생략하면 기존 트랙을 유지한다. 빈 배열 `[]`은 모든 트랙 삭제를 뜻한다. `null`은 허용하지 않는다.
- 다른 앨범의 ID, 존재하지 않는 ID, 중복 ID, 중복/유효하지 않은 트랙 번호, 빈 제목은 HTTP 400으로 거부한다.
- 트랙 번호는 양의 정수이며, 번호 교환은 트랜잭션 안에서 임시 번호를 거쳐 처리한다. 저장 실패 시 트랙 변경과 삭제된 응원법도 함께 롤백된다.
- 발매 일정 연동 정책은 기존과 같다. 앨범 수정/삭제 후 일정은 일정 관리에서 별도로 수정한다.

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

## 응원법 (fanchant)

곡마다 공식 응원법 영상(또는 음원 영상)을 걸고, 재생 시각에 맞춰 가사와 응원법을 강조한다.
데이터는 `track_fanchant`에 곡당 한 벌(`track_id` PK)로 저장한다.

### 데이터 구조 (`lines_json`)
```jsonc
[
  { "gap": true },                                  // 빈 줄 = 문단 구분
  { "t": 42.31, "hg": 0, "parts": [                 // t: 줄 시작(초), hg: 유지 블록 번호
      { "text": "프로미스나인 …", "type": "call", "t": 42.31 },  // 따로 외치기
      { "text": " 우리", "t": 43.0 }                            // 가사(type 없음)
  ]}
]
```
- `type`: `call`(따로 외치기) · `sing`(같이 부르기). 없으면 가사
- `t`: 그 조각이 시작하는 시각. **안 찍었으면 `null`** — 화면에서는 앞 조각 시각을 물려받는다
- `hg`: **유지 블록** 번호. 같은 번호끼리 한 덩어리이고, 그 안의 응원법은 블록이 끝날 때까지 강조가 남는다
  (함성처럼 뒤따르는 가사가 흐르는 내내 외치는 자리). 빈 줄도 블록 안이면 `hg`를 갖는다 —
  안 그러면 저장할 때마다 블록이 빈 줄에서 끊긴다

### GET /fanchant
응원법이 있는 곡 목록 (곡 상세에서 링크를 띄울지 판단용).

**응답:** `{ items: [{ trackId, title, albumTitle }] }`
- **`published = 1`인 곡만** 나온다 (아래 참고)

### GET /fanchant/:trackId
곡 응원법 조회 (공개). 재생 중 매 프레임 계산해야 해서 한 벌을 통째로 내려준다.

**응답:** `{ trackId, trackTitle, albumId, albumTitle, videoId, video, colors, lines }`
- `video`: 아카이브에 있으면 `{ title, channelName, publishedAt }`, 없으면 `null`
- `colors`: `{ call, sing }` — 관리자 지정값 > 앨범 커버에서 뽑은 두 색 > 커버가 단색이면 진한 변주 > 기본값
- 곡이 없거나, 영상이 없거나, **아직 공개하지 않았으면**(`published = 0`) 404 — 주소를 알아도 못 본다

#### 초안과 공개 (`published`)
싱크는 곡당 100~250개 지점을 찍는 작업이라 한 번에 안 끝난다. 종전에는 공개 조건이
"시각이 하나라도 찍혔는가"여서, 중간에 저장하면 반쯤 찍힌 응원법이 곧바로 팬에게 보였다
(그래서 저장 자체를 망설이게 됐다 — 실제로 곡당 30번 가까이 손으로 저장한 기록이 남아 있다).
공개 여부를 따로 두어, 편집기는 마음껏 자동 저장하고 다 되면 관리자가 공개를 켠다.

### GET /fanchant/:trackId/admin (인증)
편집용. 응원법이 아직 없으면 `lyrics`(곡 가사)를 초기값으로 준다.

**응답:** `{ trackId, trackTitle, albumTitle, coverUrl, lyrics, videoId, published, colors, colorSource, manualColors, lines }`

### PUT /fanchant/:trackId (인증)
저장. **본문:** `{ videoId, colorCall?, colorSing?, published?, lines }`
- 색은 `#RRGGBB` 형식만. 비우면(`null`) 커버에서 자동 추출
- `published` 생략 시 `false` — 편집기는 항상 현재 토글 상태를 함께 보낸다
- 편집기가 **입력이 멈추고 3초 뒤 자동으로** 호출한다(연타 중에는 안 나간다). Ctrl+S는 즉시 저장
- **응답:** `{ success, lines, synced, total }` (synced/total = 시각을 찍은 줄 수)

### DELETE /fanchant/:trackId (인증)
삭제. 등록된 응원법이 없으면 404.

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

### GET /admin/youtube-bots/:id/scheduled
이 봇이 잡아둔 예정 일정(`is_temp = 1`) 하나. 없으면 `{ "scheduled": null }`

**응답:**
```json
{
  "scheduled": { "id": 3800, "title": "이단장 시즌2 EP.7", "date": "2026-08-24", "time": "17:00" }
}
```

### PUT /admin/youtube-bots/:id/scheduled
예정 일정 수정. 한 주 쉬어 뒤로 미루거나, 공지에 뜬 날짜로 맞출 때 쓴다.
봇은 날짜를 보고 영상을 얹으므로(같은 날 예정이 있으면 승격) 날짜를 옮기면 그날을 기다린다.

**Request Body:**
```json
{
  "date": "2026-08-24",
  "time": "17:00",
  "title": "이단장 시즌2 EP.7"
}
```
- `time`을 `null`로 주면 시간 미정으로 지운다
- `title` 생략 시 제목은 그대로

### DELETE /admin/youtube-bots/:id/scheduled
예정 일정 삭제. 다음 것은 마감 요일(`deadline_day_of_week`)에 다시 선다

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
- **기존 일정과의 중복 판정**은 `services/festival/dedupe.js` (테스트: `npm run test:dedupe`)
  - `exact` — 제목이 서로를 포함(7자 이상·길이비 0.4 이상) → **큐에 안 담고 건너뛴다**
  - `suspect` — 같은 날짜·같은 카테고리 + **고유 낱말이 겹침** → 담되 '중복 의심' 표시
  - 종전에는 같은 날짜·카테고리이기만 하면 전부 suspect였다. 축제철엔 하루에 여러 학교가
    겹치므로 "가천대학교 축제"에 "인하대학교 비룡제"가 붙었다(이 규칙이 낸 힌트는 그 오탐뿐).
    반대로 글자 유사도로 바꾸면 "인하대학교 축제" ↔ "인하대학교 2026 비룡제"가 0.32로 갈라져
    **진짜 중복을 놓친다**. 그래서 흔한 낱말(축제·대학교·콘서트…)을 뺀 고유 낱말로 본다
- **멤버 생일은 큐에 담지 않는다** — `members.birth_date`로 매년 자동 표시되므로 담아봐야 중복이다.
  Gemini 프롬프트로 한 번, 적재 직전 코드로 한 번 거른다(모델은 확률적이라 새어나온다).
  판정은 제목에 `생일`이 있고 + 날짜가 어느 멤버 생일과 같거나 제목에 그 멤버 이름이 있을 때.
  단 `생일카페`·`지하철 광고`·`서포트`처럼 그날 따로 열리는 행사는 별개 일정이라 남긴다
- 유튜브 항목은 **담당 봇이 있는 시리즈만** 큐에서 뺀다. 담당 = `bot_youtube`에서
  `enabled=1 AND add_to_schedule=1`인 봇의 `auto_schedule_config`(`episodeMatch`·`titleTemplate`)와 채널명.
  아카이브 전용 봇(`add_to_schedule=0`)은 일정을 안 만드니 담당으로 치지 않는다.
  카테고리를 통째로 빼면 '인기가요 끝나면 매점가요'·'K판 입덕투어2'처럼 **비정기·1회성이라
  봇에 등록돼 있지 않은 콘텐츠**가 어디에도 안 잡힌다(실제로 놓친 사례).
  `title_filters`는 키로 쓰지 않는다 — 대부분 `["프로미스나인"]`이라 거의 모든 항목에 걸린다
- 날짜 후보가 여럿인 줄("8/21 or 28")은 **한 건**으로 뽑고 날짜는 미정, `description`에 후보를 남긴다.
  후보 수만큼 쪼개면 확정 뒤에도 못 쓸 행이 큐에 남는다(실제로 8/21·8/28 두 건이 남았다).
  "1일차/2일차", "EP.7/EP.8"처럼 실제로 여러 번 열리는 일정은 종전대로 각각 별개 항목
- 최신 글에 더 이상 없는 대기 항목은 `stale_at`으로 표시한다(`markStaleItems`).
  DC 글은 누적본이라 지난 일정만 지워지므로, **아직 안 지난 일정이 사라졌다면 날짜가 바뀌었거나 취소된 것**이다.
  지우지 않고 표시만 한다 — 원문이 흔들리거나 파싱이 부실한 날 큐가 통째로 날아가면 안 된다.
  지난 날짜는 대상에서 빼고(자연히 사라진다), 다시 나타나면 표시를 도로 지운다. 추출이 0건인 날은 건너뛴다
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
  "description": "박지원 뮤지컬 일정으로 불참",
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
- `payload` (JSON string): `{ subtype, title, schoolName, description, date, time, memberIds, venue, postUrls }`
  - `subtype`: 현재 `'university'`만 지원
  - `description`: **선택**. 자유 텍스트 — 대학 축제는 멤버별 참여가 갈린다
    ("박지원 뮤지컬 일정으로 불참"). 공개 상세에 제목 아래로 그대로 나온다
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

## 관리자 - Nitter 세션 (전용 키)

X가 자동 로그인을 막아 세션은 브라우저에서 뽑는다. 크롬 확장(`/docker/extension/nitter-session`)이
x.com 쿠키를 읽어 이 API로 보내면 `sessions.jsonl`이 갱신되고, 호스트 크론이 1분 내 nitter를 재시작한다.
인증은 관리자 JWT가 아니라 **`X-Session-Key` 헤더**(.env `NITTER_SESSION_KEY`) — 확장에 JWT를 넣으면 만료 때마다 갱신해야 해서다.

### GET /admin/nitter/session
등록된 세션 목록. **응답:** `{ sessions: [{ username, id }] }` (토큰은 주지 않는다)

### PUT /admin/nitter/session
세션 등록/갱신. **본문:** `{ id, authToken, ct0, username? }`
- 같은 계정(id)이 있으면 토큰만 교체하고 username은 유지, 없으면 추가
- **응답:** `{ success, updated, sessions[], note }`

---

## 관리자 - 수집 큐 (인증 필요)

DC봇이 적재한 신규 일정 후보(`bot_pending_schedules`)를 검토·등록·무시한다.

### GET /admin/pending
대기 목록. `?status=pending|registered|dismissed`(기본 pending).

**응답:** `{ items: [{ id, category, title, date, time, members[], venueName, description, dupHint, stale, status, ... }] }`
- `dupHint` — 같은 날·같은 카테고리에 비슷한 일정이 이미 있을 때 그 요약 (관리자 화면 '중복 의심' 배지)
- `stale` — 최신 DC 글에 더 이상 없는 항목. 날짜가 바뀌었거나 취소됐을 수 있다 ('원문에서 사라짐' 배지)
- `createdScheduleId` — 먼저 생성된 일정 ID. `pending`이면서 값이 있으면 포스터 처리/등록 완료를 재시도할 수 있는 항목이다.

### GET /admin/pending/count
대기 건수 (배지용). **응답:** `{ count }`

### POST /admin/pending/:id/register
검토 후 등록. **multipart 본문:** `payload` JSON `{ category, title, date, time?, venue?, venueName?, description?, postUrls?, broadcaster?, replayUrl? }` + 선택적인 포스터 파일들.
- `기타` → `schedule_etc`, `행사` → `schedule_event`(general)로 생성. `venueName`은 카카오로 지오코딩
- `유튜브` → **예정 일정**(`schedules.is_temp=1` + `schedule_youtube.video_id=NULL`)으로 생성.
  영상이 아직 없으므로 장소·포스터·링크는 무시한다. 나중에 영상이 올라오면 봇이 제목으로 찾아 승격한다(아래)
- `예능` → `schedule_variety`로 생성. `broadcaster` 필수(NOT NULL), `description`으로 출연 내용을 적는다.
  장소·포스터·링크는 쓰지 않는다
- 그 외 카테고리는 400(`UNSUPPORTED_CATEGORY`) — 관리자 폼에서 직접 추가 후 무시
- 일정 생성과 큐의 `created_schedule_id` 연결은 같은 트랜잭션으로 저장한다. 포스터 처리와 `status='registered'` 전환은 다음 트랜잭션으로 확정한다.
- 최초 생성 완료는 HTTP 201, 같은 항목의 재시도/이미 완료된 요청은 HTTP 200과 동일한 `{ id }`를 반환한다. 동시 등록도 큐 행 잠금으로 직렬 처리하며 일정/포스터를 중복 등록하지 않는다.
- 포스터/완료 처리 실패는 HTTP 500 `{ error, createdScheduleId }`. 큐는 `pending`이고 이미 생성한 일정은 유지된다. 같은 항목에 다시 등록하면 포스터만 처리하며, 제목·날짜 등 저장된 일정 정보는 덮어쓰지 않는다. 변경은 일정 관리 화면에서 한다. 포스터 없이 재시도하면 기존 일정으로 등록을 완료한다.
- 큐의 최초 분류와 재시도 payload가 달라도 포스터는 실제 저장된 일정 카테고리에 붙인다. 별도로 첨부한 기존 포스터도 보존한다.
- 무시된 항목, 연결된 일정이 삭제된 항목은 HTTP 409. 삭제된 일정을 자동으로 재생성하지 않는다.

### POST /admin/pending/:id/dismiss
무시 처리 (`status='dismissed'`). **응답:** `{ success: true }`
- 이미 일정이 생성된 항목(포스터 재시도 대기 포함)이나 등록 완료 항목은 HTTP 409. 등록/무시 동시 요청도 큐 행 잠금으로 처리한다.
- 행을 지우지 않고 남긴다. `dedup_key` 유니크 + `INSERT IGNORE`라 **같은 키는 다시 안 담긴다**
- 단 `dedup_key`가 `날짜|정규화제목`이라 **날짜나 제목이 바뀌면 다시 담긴다**(일정이 실제로 옮겨졌을 수 있으므로 의도된 동작)

### 예정 유튜브 일정 승격 (`utils/tempSchedule.js`)
`is_temp=1`이고 `video_id`가 비어 있는 유튜브 일정을, 나중에 올라온 영상으로 채운다.
- 매칭: **예정 제목이 영상 제목에 포함**(공백·구두점·이모지 제거 후 비교) + 날짜 ±7일. 6자 미만 제목은 제외
- 호출 지점 셋 — 유튜브 봇(`add_to_schedule=1`은 채널+날짜 매칭 실패 시, `=0`은 아카이브 직후), X봇(`saveYoutubeFromTweet`)
- X봇은 `video_id`로만 중복을 봐서 예정 일정을 못 찾고 같은 회차를 하나 더 만들던 자리다

---

## 관리자 - 팬사인회 (인증 필요)

팬사인회(카테고리 5)는 `schedule_fansign`(format, host, venue_id, post_urls)에 1:1로 저장. JSON 본문.

### POST /admin/fansign
팬사인회 생성

**본문:** `{ title, date, time?, format, host?, venue?, venueName?, postUrls? }`
- `format`: `'offline'`(대면) | `'online'`(영상통화) | `'both'`(대면+영상통화). 기본 `'offline'`
- `host`: 주최(음반점·판매처). 예: 뮤직아트, 비트로드
- `venue` / `venueName`: **선택**. 좌표까지 고른 장소는 `venue`(`{ name, address?, lat?, lng?, kakao_id? }`),
  이름만 알면 `venueName`으로 주면 서버가 카카오로 찾는다. `event_venues`에 upsert
- `postUrls`: 출처 링크 문자열 배열 (판매처 공지·X 원문 등). `post_urls`(JSON)에 저장
- `title`, `date` 필수

**응답:** `{ "success": true, "scheduleId": 3201 }`

#### 장소는 왜 선택인가
비공개 팬사인회는 장소가 당첨자에게 개별 안내되어 공지에 없다. 반면 공개 팬사인회
(예: 스타필드 수원 타워 아트리움)는 장소가 그대로 공지된다. 그래서 있으면 넣고,
없으면 화면에서 "장소는 당첨자에게 개별 안내됩니다"를 그대로 보여준다.

### PUT /admin/fansign/:id
팬사인회 수정 (본문은 POST와 동일). 장소를 빼고 보내면 지워진다

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
- `action=error` - 오류만 조회. 건수와 페이지 수에도 동일 조건 적용; 생략하면 전체 액션.
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

### YouTube 봇 필터 확장 (2026-09-18)

`GET/POST/PUT /api/admin/youtube-bots`의 봇 설정에 다음 필드를 추가한다.

| 필드 | 형식 | 의미 |
| --- | --- | --- |
| `description_filters` | string[] 또는 null(입력) | 설명 키워드. 응답은 배열 |
| `filter_mode` | `split` / `legacy` | 신규 기본값 split, 기존 통합 필터 호환용 legacy |
| `min_duration_seconds` | 정수 0–86400 | 일반 영상 최소 길이(이상), 0은 제한 없음. 쇼츠에는 미적용 |

split에서는 `title_filters`가 제목에만 적용된다. 제목/설명 각각은 OR, 두 필드 사이는 AND이며 빈 필드는 통과한다. 기존 legacy 봇의 unrelated 설정 수정은 필터 모드를 유지한다. `auto_schedule_config.episodeMatch`는 회차 계산에 포함할 제목 문구이며 관리자 폼에서도 보존/수정한다.

X 봇의 기존 `exclude_managed_channels` 값은 호환성을 위해 DB에 남지만 수집에는 사용하지 않는다. `extract_youtube=true`이면 모든 채널의 링크를 처리하고 영상 ID로 중복을 방지한다.

### POST /admin/instagram/posters (관리자)

입력한 공개 인스타그램 게시물에서 포스터 후보 사진을 가져온다. Gemini 호출 없음.

- Body: `{ "url": "https://www.instagram.com/p/SHORTCODE/" }`
- 응답: `{ "postUrl": "정규화한 게시물 주소", "images": [{ "name": "instagram-SHORTCODE-1.jpg", "dataUrl": "data:image/jpeg;base64,..." }] }`
- JWT 인증 필수, 요청 본문 4KB 이하, IP당 분당 6회, 프로세스당 동시 가져오기 1건. 응답은 `Cache-Control: no-store`.
- `instagram.com`/`www.instagram.com`/`m.instagram.com`의 HTTPS `p`/`reel`/`tv` 게시물 주소만 허용. 추적 쿼리는 제거한다. 서버는 고정 Instagram embed 주소와 검증한 Instagram/Meta CDN에만 요청하며 리다이렉트는 따르지 않는다.
- 최대 20장, HTML 4MB, 입력 이미지당 8MB·합계 25MB, 출력 이미지 합계 25MB, 요청 전체 60초. JPEG/PNG/WebP를 확인하고 최대 2160px JPEG(quality 92)로 변환한다. 동영상 썸네일은 제외한다.
- 400: 잘못된 주소 / 401: 인증 실패 / 429: 호출 제한·가져오기 진행 중 / 502: 비공개·접근 제한·사진 없음·형식/용량 제한 등 가져오기 실패.
- 이 요청은 일정이나 스토리지에 이미지를 저장하지 않는다. 프론트에서 선택한 후보를 `File`로 바꿔 기존 등록 API의 multipart 포스터 필드로 전송하고, 최종 일정 저장 시 RustFS에 업로드한다.
- 성공·실패는 `instagram_poster` 대상으로 활동 로그를 남긴다. CDN 주소·이미지 데이터·추적 쿼리는 로그에 저장하지 않는다.
- JSON 형식의 embed와 단일 사진 HTML embed를 지원한다. HTML 형식은 단일 사진임을 확인한 뒤 `EmbeddedMediaImage`의 가장 큰 srcset 이미지를 사용하며 CDN 검증은 동일하게 적용한다.

#### 수집 큐 등록 시간 변경

`POST /admin/pending/:id/register`의 `payload.time`은 생략하면 기존 수집 시간을 사용한다. 명시적 `null` 또는 빈 문자열은 시간 미정으로 저장한다. 모바일 검토 화면의 시간 미정 전환도 동일한 계약을 따른다.

### POST /admin/instagram/caption (관리자)

학교 축제 등의 일정 제목을 편집하기 위한 공개 게시글 본문 조회. Body는 `{ "url": "https://www.instagram.com/p/SHORTCODE/" }`, 응답은 `{ "postUrl": "정규화한 주소", "caption": "게시글 본문" }`.

- 기존 포스터 가져오기와 URL 검증·embed 파서를 공유한다. 사진 다운로드나 Gemini 호출은 하지 않는다. 영상 게시물도 본문이 있으면 사용할 수 있다.
- 본문 포함 `/embed/captioned/` 응답에서 JSON 또는 HTML Caption을 읽는다. HTML의 계정명·댓글 안내는 제외하고 줄바꿈과 문자 엔티티를 복원한다.
- 인증 필수, 본문 4KB, IP당 분당 6회, 포스터 가져오기와 동시 처리 제한 공유. 외부 요청 15초·HTML 4MB, 반환 본문 최대 20,000자, 응답 no-store.
- 잘못된 주소 400, 미인증 401, 처리 중/호출 제한 429, 접근 불가·본문 없음 등 502. 실패 시 직접 입력 가능.
- 활동 로그 대상 `instagram_caption`: 성공 upload / 실패 error. 정규화한 링크만 기록하며 게시글 본문은 보관하지 않는다. 이 API는 일정 제목이나 큐를 변경하지 않는다.

### 일정 고정 링크 관리

- `GET /api/admin/schedule-links`: 전체 목록. `id`, `title`, `url`, `startsAt`, `endsAt`, `sortOrder`, `enabled` 반환.
- `POST /api/admin/schedule-links`, `PUT /api/admin/schedule-links/:id`: 제목·URL·표시 기간 및 `enabled`(boolean) 저장. 생성 시 생략하면 공개, 수정 시 생략하면 기존 공개 여부 유지(기존 PC 클라이언트 호환).
- `PATCH /api/admin/schedule-links/:id/visibility`: `{ "enabled": false }` 등으로 공개 여부만 변경. 제목·기간·순서는 유지.
- `PUT /api/admin/schedule-links/order`: `{ "ids": [2, 1] }` 전체 ID 목록의 순서로 저장. 중복·누락·변경된 목록은 400, 트랜잭션으로 일괄 반영.
- `DELETE /api/admin/schedule-links/:id`: 삭제. 위 관리자 API는 인증 필수.
- 공개 `GET /api/schedule-links`는 `is_enabled = 1`이면서 표시 기간에 해당하는 링크만 반환한다. 기간은 기존과 동일하게 한국 시간 벽시계 문자열(`YYYY-MM-DDTHH:mm`), null이면 해당 경계 제한 없음.
