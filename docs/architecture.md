# 프로젝트 구조

## 디렉토리 구조

```
fromis_9/
├── backend/                    # Fastify 백엔드
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.js        # 환경변수 통합 관리
│   │   │   └── bots.js         # 봇 설정 (YouTube, X)
│   │   ├── plugins/            # Fastify 플러그인
│   │   │   ├── db.js           # MariaDB 연결
│   │   │   ├── redis.js        # Redis 연결
│   │   │   ├── auth.js         # JWT 인증
│   │   │   ├── meilisearch.js  # 검색 엔진
│   │   │   └── scheduler.js    # 봇 스케줄러
│   │   ├── routes/             # API 라우트
│   │   │   ├── admin/          # 관리자 API
│   │   │   │   ├── bots.js     # 봇 관리
│   │   │   │   ├── youtube-bots.js  # YouTube 봇 CRUD
│   │   │   │   ├── x-bots.js   # X 봇 CRUD
│   │   │   │   ├── youtube.js  # YouTube 일정 관리
│   │   │   │   ├── x.js        # X 일정 관리
│   │   │   │   └── logs.js     # 활동 로그 조회
│   │   │   ├── albums/
│   │   │   │   ├── index.js    # 앨범 CRUD
│   │   │   │   ├── photos.js   # 앨범 사진 관리
│   │   │   │   └── teasers.js  # 앨범 티저 관리
│   │   │   ├── auth.js         # 인증 (로그인, 토큰 검증)
│   │   │   ├── members/
│   │   │   │   └── index.js    # 멤버 조회/수정
│   │   │   ├── schedules/
│   │   │   │   ├── index.js    # 일정 조회/검색/삭제
│   │   │   │   └── suggestions.js  # 추천 검색어
│   │   │   ├── stats/
│   │   │   │   └── index.js    # 통계 조회
│   │   │   └── index.js        # 라우트 등록
│   │   ├── services/           # 비즈니스 로직
│   │   │   ├── youtube/        # YouTube 봇
│   │   │   │   ├── api.js      # YouTube Data API 호출
│   │   │   │   └── index.js    # 봇 로직 (동기화, 저장)
│   │   │   ├── x/              # X(Twitter) 봇
│   │   │   ├── meilisearch/    # 검색 서비스
│   │   │   └── suggestions/    # 추천 검색어
│   │   ├── utils/              # 유틸리티
│   │   │   ├── cache.js        # Redis 캐시 헬퍼 (SCAN 사용)
│   │   │   ├── date.js         # 날짜 유틸 (KST 변환)
│   │   │   ├── error.js        # 에러 응답 헬퍼
│   │   │   ├── log.js          # 활동 로그 유틸 (fire-and-forget)
│   │   │   ├── logger.js       # 로깅 유틸
│   │   │   └── transaction.js  # DB 트랜잭션 래퍼
│   │   ├── app.js              # Fastify 앱 설정
│   │   └── server.js           # 진입점
│   ├── Dockerfile              # 백엔드 컨테이너
│   └── package.json
│
├── frontend/                   # React 프론트엔드
│   ├── src/
│   │   ├── api/                # API 클라이언트
│   │   │   ├── index.js
│   │   │   ├── client.js       # fetchApi, fetchAuthApi
│   │   │   ├── public/         # 공개 API
│   │   │   │   ├── albums.js
│   │   │   │   ├── members.js
│   │   │   │   └── schedules.js
│   │   │   └── admin/          # 관리자 API
│   │   │       ├── albums.js
│   │   │       ├── members.js
│   │   │       ├── schedules.js
│   │   │       ├── categories.js
│   │   │       ├── stats.js
│   │   │       ├── bots.js
│   │   │       ├── logs.js
│   │   │       ├── auth.js
│   │   │       └── suggestions.js
│   │   │
│   │   ├── hooks/              # 커스텀 훅
│   │   │   ├── index.js
│   │   │   ├── common/         # 공통 훅
│   │   │   │   └── useToast.js
│   │   │   └── pc/
│   │   │       └── admin/      # 관리자 훅
│   │   │           ├── useAdminAuth.js
│   │   │           └── useScheduleSearch.js
│   │   │
│   │   ├── stores/             # Zustand 스토어
│   │   │   ├── index.js
│   │   │   ├── useScheduleStore.js
│   │   │   └── useAuthStore.js
│   │   │
│   │   ├── utils/              # 유틸리티
│   │   │   ├── index.js
│   │   │   ├── cn.js           # className 병합
│   │   │   ├── color.js        # 색상 상수/유틸
│   │   │   ├── confetti.js     # 축하 효과 (생일, 데뷔/주년)
│   │   │   ├── date.js         # 날짜 포맷
│   │   │   ├── format.js       # 문자열 포맷
│   │   │   ├── schedule.js     # 일정 관련 유틸
│   │   │   └── youtube.js      # YouTube URL 파싱
│   │   │
│   │   ├── constants/
│   │   │   └── index.js        # 상수 정의
│   │   │
│   │   ├── components/
│   │   │   ├── index.js
│   │   │   ├── common/         # 공통 컴포넌트
│   │   │   │   ├── Loading.jsx
│   │   │   │   ├── ErrorBoundary.jsx
│   │   │   │   ├── ErrorMessage.jsx
│   │   │   │   ├── Toast.jsx
│   │   │   │   ├── Tooltip.jsx
│   │   │   │   ├── Lightbox.jsx
│   │   │   │   ├── MobileLightbox.jsx
│   │   │   │   ├── LightboxIndicator.jsx
│   │   │   │   ├── AnimatedNumber.jsx
│   │   │   │   ├── ScrollToTop.jsx
│   │   │   │   ├── Fromis9Logo.jsx         # 프로미스나인 로고 SVG
│   │   │   │   └── DebutCelebrationDialog.jsx  # 데뷔/주년 축하 다이얼로그
│   │   │   │
│   │   │   ├── pc/
│   │   │   │   ├── public/     # PC 공개 컴포넌트
│   │   │   │   │   ├── layout/
│   │   │   │   │   │   ├── Layout.jsx
│   │   │   │   │   │   ├── Header.jsx
│   │   │   │   │   │   └── Footer.jsx
│   │   │   │   │   └── schedule/
│   │   │   │   │       ├── Calendar.jsx
│   │   │   │   │       ├── ScheduleCard.jsx
│   │   │   │   │       ├── BirthdayCard.jsx
│   │   │   │   │       ├── DebutCard.jsx        # 데뷔/주년 카드
│   │   │   │   │       └── CategoryFilter.jsx
│   │   │   │   │
│   │   │   │   └── admin/      # PC 관리자 컴포넌트
│   │   │   │       ├── layout/
│   │   │   │       │   ├── Layout.jsx
│   │   │   │       │   └── Header.jsx
│   │   │   │       ├── common/
│   │   │   │       │   ├── ConfirmDialog.jsx
│   │   │   │       │   ├── DatePicker.jsx
│   │   │   │       │   ├── TimePicker.jsx
│   │   │   │       │   ├── NumberPicker.jsx
│   │   │   │       │   └── CustomSelect.jsx
│   │   │   │       ├── schedule/
│   │   │   │       │   ├── AdminScheduleCard.jsx
│   │   │   │       │   ├── ScheduleItem.jsx
│   │   │   │       │   ├── CategorySelector.jsx
│   │   │   │       │   ├── CategoryFormModal.jsx
│   │   │   │       │   ├── MemberSelector.jsx
│   │   │   │       │   ├── ImageUploader.jsx
│   │   │   │       │   ├── LocationSearchDialog.jsx
│   │   │   │       │   └── WordItem.jsx
│   │   │   │       ├── album/
│   │   │   │       │   ├── TrackItem.jsx
│   │   │   │       │   ├── PhotoGrid.jsx
│   │   │   │       │   ├── PhotoPreviewModal.jsx
│   │   │   │       │   ├── PendingFileItem.jsx
│   │   │   │       │   └── BulkEditPanel.jsx
│   │   │   │       ├── bot/
│   │   │   │       │   ├── BotCard.jsx
│   │   │   │       │   ├── YouTubeBotDialog.jsx
│   │   │   │       │   └── XBotDialog.jsx
│   │   │   │       └── log/
│   │   │   │           ├── constants.js
│   │   │   │           └── LogDetailDialog.jsx
│   │   │   │
│   │   │   └── mobile/         # 모바일 컴포넌트
│   │   │       ├── layout/
│   │   │       │   ├── Layout.jsx
│   │   │       │   ├── Header.jsx
│   │   │       │   └── BottomNav.jsx
│   │   │       └── schedule/
│   │   │           ├── Calendar.jsx
│   │   │           ├── ScheduleCard.jsx
│   │   │           ├── ScheduleListCard.jsx
│   │   │           ├── ScheduleSearchCard.jsx
│   │   │           ├── BirthdayCard.jsx
│   │   │           └── DebutCard.jsx        # 데뷔/주년 카드
│   │   │
│   │   ├── pages/
│   │   │   ├── pc/
│   │   │   │   ├── public/     # PC 공개 페이지
│   │   │   │   │   ├── home/
│   │   │   │   │   │   └── Home.jsx
│   │   │   │   │   ├── members/
│   │   │   │   │   │   └── Members.jsx
│   │   │   │   │   ├── album/
│   │   │   │   │   │   ├── Album.jsx
│   │   │   │   │   │   ├── AlbumDetail.jsx
│   │   │   │   │   │   ├── AlbumGallery.jsx
│   │   │   │   │   │   └── TrackDetail.jsx
│   │   │   │   │   ├── schedule/
│   │   │   │   │   │   ├── Schedule.jsx
│   │   │   │   │   │   ├── ScheduleDetail.jsx
│   │   │   │   │   │   ├── Birthday.jsx
│   │   │   │   │   │   └── sections/
│   │   │   │   │   │       ├── DefaultSection.jsx
│   │   │   │   │   │       ├── YoutubeSection.jsx
│   │   │   │   │   │       └── XSection.jsx
│   │   │   │   │   └── common/
│   │   │   │   │       └── NotFound.jsx
│   │   │   │   │
│   │   │   │   └── admin/      # PC 관리자 페이지
│   │   │   │       ├── Login.jsx
│   │   │   │       ├── Dashboard.jsx
│   │   │   │       ├── members/
│   │   │   │       │   ├── Members.jsx
│   │   │   │       │   └── MemberEdit.jsx
│   │   │   │       ├── albums/
│   │   │   │       │   ├── Albums.jsx
│   │   │   │       │   ├── AlbumForm.jsx
│   │   │   │       │   └── AlbumPhotos.jsx
│   │   │   │       ├── logs/
│   │   │   │       │   └── Logs.jsx
│   │   │   │       └── schedules/
│   │   │   │           ├── Schedules.jsx
│   │   │   │           ├── ScheduleForm.jsx
│   │   │   │           ├── ScheduleDict.jsx
│   │   │   │           ├── ScheduleBots.jsx
│   │   │   │           ├── ScheduleCategory.jsx
│   │   │   │           ├── form/
│   │   │   │           │   ├── YouTubeForm.jsx
│   │   │   │           │   └── XForm.jsx
│   │   │   │           └── edit/
│   │   │   │               └── YouTubeEdit.jsx
│   │   │   │
│   │   │   └── mobile/         # 모바일 페이지
│   │   │       ├── home/
│   │   │       │   └── Home.jsx
│   │   │       ├── members/
│   │   │       │   └── Members.jsx
│   │   │       ├── album/
│   │   │       │   ├── Album.jsx
│   │   │       │   ├── AlbumDetail.jsx
│   │   │       │   ├── AlbumGallery.jsx
│   │   │       │   └── TrackDetail.jsx
│   │   │       ├── schedule/
│   │   │       │   ├── Schedule.jsx
│   │   │       │   └── ScheduleDetail.jsx
│   │   │       └── common/
│   │   │           └── NotFound.jsx
│   │   │
│   │   ├── routes/             # 라우트 정의
│   │   │   ├── index.js        # 라우트 export
│   │   │   ├── pc/
│   │   │   │   ├── admin/
│   │   │   │   │   └── index.jsx   # PC 관리자 라우트
│   │   │   │   └── public/
│   │   │   │       └── index.jsx   # PC 공개 라우트
│   │   │   └── mobile/
│   │   │       └── index.jsx       # 모바일 라우트
│   │   │
│   │   ├── App.jsx             # PC/모바일 분기
│   │   └── main.jsx
│   │
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── .env
```

## PC / 모바일 분기

`App.jsx`가 **뷰포트 폭(matchMedia) 하나로** PC/모바일 라우트를 고른다. UA는 보지 않는다.

| 폭 | 레이아웃 | 해당 기기 |
|----|---------|----------|
| ~1099px | 모바일 (`routes/mobile`) | 폰, 폰 가로, 태블릿 세로 |
| 1100px~ | PC (`routes/pc`) | 데스크톱, 태블릿 가로 |

- **1100 경계** — 갤럭시탭 가로가 DPR 때문에 CSS 폭 1100대로 잡힌다. 1280 경계면
  태블릿 가로가 모바일로 떨어진다. PC `Layout`의 `min-w`도 1100으로 맞춰 두 값이 함께 움직인다
  (그 아래로는 기존대로 가로 스크롤)
- **태블릿 전용 UI는 없다.** 가로면 PC, 세로면 모바일 — 별도 분기를 만들지 않는 것이 이 구조의 목적
- `matchMedia`를 쓰는 이유: 개발자 도구 기기 에뮬레이션에서 `innerWidth` 갱신이나 `resize`가
  누락돼도 CSS 미디어쿼리는 토글 즉시 재평가된다. 새로고침 없이 양방향 전환되고 경로도 유지된다
- 관리자(`/admin`)는 폭과 무관하게 PC 페이지를 쓴다 (모바일 전용 관리자는 삭제됨)

> 이전에는 `react-device-detect`(UA 기반)였다. 로드 시 값이 굳어 전환이 안 되고,
> 태블릿을 지원하려면 별도 분기가 필요해 2026-08 제거했다.

## 서비스 구성

```
┌─────────────────────────────────────────────────────────┐
│                        Caddy                            │
│                   (리버스 프록시)                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              fromlog-frontend (:80)                     │
│                    Vite 개발서버                         │
│                   (프록시: /api → backend)               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              fromlog-backend (:80)                      │
│                    Fastify API                          │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────┐
         │            │            │            │
         ▼            ▼            ▼            ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│   MariaDB     │ │Meilisearch│ │   Redis   │ │  Nitter   │
│  (외부 DB망)   │ │ (검색엔진) │ │  (캐시)   │ │ (X 스크랩) │
└───────────────┘ └───────────┘ └───────────┘ └───────────┘
```

## 데이터베이스

### 테이블 목록 (28개)

#### 사용자/인증
- `admin_users` - 관리자 계정

#### 멤버
- `members` - 멤버 정보 (이름, 생년월일, 인스타그램 등)
- `member_nicknames` - 멤버 별명 (검색용)

#### 앨범
- `albums` - 앨범 정보 (제목, 발매일, 커버 이미지 등)
- `album_tracks` - 앨범 트랙 (곡명, 작사/작곡, 가사 등)
- `album_photos` - 앨범 컨셉 포토
- `album_photo_members` - 컨셉 포토-멤버 연결
- `album_teasers` - 앨범 티저 이미지/영상

#### 일정
- `schedules` - 일정 (제목, 날짜, 시간 등)
- `schedule_categories` - 일정 카테고리 (유튜브, X, 콘서트 등)
- `schedule_images` - 일정 첨부 이미지
- `schedule_youtube` - YouTube 영상 연결 정보
- `schedule_x` - X(Twitter) 게시물 연결 정보
- `schedule_concert` - 콘서트 일정 추가 정보
- `schedule_ticketing` - 티켓팅 일정 추가 정보 (선예매/일반예매 세트, 예매처, 인증 기간, 콘서트 시리즈 연결)
- `schedule_album` - 앨범 발매 일정 연결 (앨범 생성 시 자동)

#### 콘서트
- `concert_venues` - 콘서트 장소 정보
- `concert_series` - 콘서트 시리즈 (투어 등)
- `concert_series_md` - 콘서트 MD 상품
- `concert_setlists` - 콘서트 셋리스트
- `concert_setlist_members` - 셋리스트-멤버 연결

#### 행사
- `event_venues` - 행사 장소 정보 (카카오맵 기반, 콘서트와 분리)
- `schedule_event` - 행사 상세 (subtype, school_name, venue_id, post_urls JSON, poster_image_ids JSON)

#### 봇
- `bot_youtube` - YouTube 봇 설정 (채널 정보, 동기화 간격 또는 주간 지정 시간, 필터 등, video_id UNIQUE)
- `bot_x` - X 봇 설정 (username, 프로필, 동기화 간격, 텍스트 필터, 리트윗 포함, YouTube 추출)

#### 활동 로그
- `logs` - 관리자/봇 활동 로그 (actor, action, category, summary 등)

#### 이미지
- `images` - 이미지 메타데이터 (3개 해상도 URL)

#### 추천 검색어
- `suggestion_queries` - 검색 쿼리 로그
- `suggestion_word_pairs` - 단어 bi-gram 빈도
- `suggestion_chosung` - 초성 검색 매핑

### 검색 인덱스 (Meilisearch)
- `schedules` - 일정 검색용 인덱스
  - 검색 필드: title, member_names, source_name, category_name
  - 필터: category_id, date
  - 정렬: date, time
  - 동기화: 봇/수동 일정 추가/수정/삭제 시 실시간 동기화
