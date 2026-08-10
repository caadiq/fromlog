# 활동 로그 시스템

## 개요

관리자 페이지에서 모든 행동(관리자 수동 작업 + 봇 자동 작업)에 대한 로그를 조회할 수 있는 시스템.
앨범 CRUD, 멤버 수정, 일정 추가/수정/삭제, 봇 동기화 등 모든 활동을 DB에 기록하고 관리자 페이지에서 필터링/페이지네이션으로 조회.

---

## DB 테이블

### `logs`

```sql
CREATE TABLE logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor       VARCHAR(50)   NOT NULL,     -- "admin" 또는 봇 ID ("youtube-3", "x-1" 등)
  action      VARCHAR(50)   NOT NULL,     -- create, update, delete, start, stop, sync_complete, error 등
  category    VARCHAR(30)   NOT NULL,     -- album, schedule, member, bot, category, dict, concert, sync
  target_type VARCHAR(50)   DEFAULT NULL, -- youtube_schedule, x_schedule, album, photo, member 등
  target_id   INT UNSIGNED  DEFAULT NULL,
  summary     VARCHAR(500)  NOT NULL,     -- 사람이 읽을 수 있는 한 줄 요약
  details     JSON          DEFAULT NULL, -- 추가 상세 정보
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_category (category),
  INDEX idx_actor (actor)
);
```

### 컬럼 설명

| 컬럼 | 설명 | 예시 |
|------|------|------|
| `actor` | 행위자 | `"admin"`, `"youtube-3"`, `"x-1"`, `"meilisearch"` |
| `action` | 행동 유형 | `create`, `update`, `delete`, `upload`, `start`, `stop`, `sync_complete`, `error` |
| `category` | 대분류 | `album`, `schedule`, `member`, `bot`, `category`, `dict`, `concert`, `sync` |
| `target_type` | 대상 타입 | `youtube_schedule`, `x_schedule`, `album`, `photo`, `teaser`, `member`, `youtube_bot`, `x_bot`, `category`, `concert` |
| `target_id` | 대상 DB ID | 해당 레코드의 PK |
| `summary` | 한 줄 요약 | `"YouTube 일정 생성: fromis_9 영상 제목"` |
| `details` | 추가 정보 (JSON) | `{ "videoId": "abc123", "channelName": "채널명" }` |

---

## 백엔드 구현

### 로그 유틸리티

**파일:** `backend/src/utils/log.js`

```javascript
import { logActivity } from '../utils/log.js';

logActivity(db, { actor, action, category, targetType, targetId, summary, details });
```

- fire-and-forget: 로그 실패가 비즈니스 로직에 영향 주지 않도록 try/catch 감싸기
- 트랜잭션 외부에서 호출 (로그 실패가 롤백 유발하지 않도록)

### API 엔드포인트

**GET /api/admin/logs** — 로그 목록 조회 (인증 필수)

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | integer | 1 | 페이지 번호 |
| `limit` | integer | 50 | 페이지당 개수 (최대 100) |
| `category` | string | - | 카테고리 필터 (콤마 구분) |
| `actor` | string | - | 행위자 필터 (`"admin"` 또는 `"bot"`) |
| `search` | string | - | summary 검색 |
| `from` | string | - | 시작 날짜 (YYYY-MM-DD) |
| `to` | string | - | 종료 날짜 (YYYY-MM-DD) |

### 로그 삽입 대상

#### 관리자 수동 작업

| 파일 | 로그 대상 |
|------|----------|
| `routes/admin/youtube.js` | YouTube 일정 생성/수정 |
| `routes/admin/x.js` | X 일정 생성 |
| `routes/admin/concert.js` | 콘서트 일정 생성 |
| `routes/admin/youtube-bots.js` | YouTube 봇 생성/수정/삭제 |
| `routes/admin/x-bots.js` | X 봇 생성/수정/삭제 |
| `routes/admin/bots.js` | 봇 시작/정지/전체동기화 |
| `routes/albums/index.js` | 앨범 생성/수정/삭제 |
| `routes/albums/photos.js` | 사진 업로드/삭제 |
| `routes/albums/teasers.js` | 티저 삭제 |
| `routes/members/index.js` | 멤버 수정 |
| `routes/schedules/index.js` | 일정 삭제, 카테고리 CRUD |
| `routes/schedules/suggestions.js` | 사전 저장 |

#### 봇 자동 작업

| 파일 | 로그 대상 |
|------|----------|
| `plugins/scheduler.js` | 동기화 완료 (addedCount > 0일 때만), 에러 |
| `services/youtube/index.js` | 영상 추가 성공 |
| `services/x/index.js` | 트윗 추가 성공 |

> **봇 로그 전략:** 변화 없는 동기화는 로그 안 남김. `addedCount > 0`이거나 에러인 경우만 기록.

### 연속 오류 시 자동 정지

`plugins/scheduler.js`의 `MAX_CONSECUTIVE_ERRORS`(기본 10)로 제어.

- Redis의 bot status에 `consecutiveErrors` 카운터를 유지. 성공 시 0으로 리셋, 실패 시 +1.
- 동일한 에러 루프에서 `sync/error` 로그는 **첫 1회만** 기록 (로그 테이블 스팸 방지).
- 카운터가 `MAX_CONSECUTIVE_ERRORS`에 도달하면 `stopBot()`을 호출해 cron 태스크를 내리고, `bot/stop` action으로 *"${botId} 연속 N회 실패로 자동 정지"* 로그 1건을 남김.
- 자동 정지된 봇은 원인 조치 후 관리자 UI에서 수동으로 다시 시작해야 함.

---

## 프론트엔드 구현

### 파일 구조

| 파일 | 내용 |
|------|------|
| `frontend/src/api/admin/logs.js` | API 클라이언트 |
| `frontend/src/pages/pc/admin/logs/Logs.jsx` | 로그 페이지 컴포넌트 |

### 로그 페이지

**경로:** `/admin/logs`

**UI 구성:**
- 필터 바: 카테고리 칩, 행위자 드롭다운(애니메이션), 기간 선택(커스텀 DatePicker), 텍스트 검색(300ms 디바운스)
- 로그 테이블: 시간, 행위자(아이콘), 액션 뱃지(색상별), 카테고리, summary
- 서버 사이드 페이지네이션 (keepPreviousData로 깜빡임 방지)

**액션 뱃지 색상:**
| 액션 | 색상 |
|------|------|
| create / upload | 초록 |
| update | 파랑 |
| delete / error | 빨강 |
| sync_complete | 보라 |
| start / stop | 노랑 |
