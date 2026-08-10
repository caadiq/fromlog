# fromis_9 개선 작업 계획서

코드 리뷰(2026-06) 결과를 바탕으로 한 단계별 개선 계획. 범위는 **fromis_9 프론트+백엔드**(Flutter 앱 제외).

## 원칙
- **작고 확실한 것 → 성능 → 캐시 → (보류) 리팩터링** 순서. 한 번에 다 건드리지 않음.
- 웨이브 단위로 커밋. 각 항목은 **변경 + 검증**을 짝으로 진행.
- 백엔드 변경 후 `docker restart fromlog-backend`로 부팅/동작 확인, 프론트는 HMR 로그로 컴파일 확인.
- 회귀 위험이 보이면 멈추고 보고.

---

## 웨이브 1 — 버그·보안 핫픽스 (작고 안전)

리스크 낮음, 코드 소량. 한 커밋으로 묶음.

### 1-1. X봇 생성 ReferenceError (확정 버그)
- **파일**: `backend/src/routes/admin/x-bots.js`
- **문제**: `exclude_managed_channels`가 POST body 구조분해(180-188)·스키마(160-171)에 없는데 INSERT(209)에서 사용 → ES strict mode라 X봇 생성 시 `ReferenceError` 크래시.
- **변경**: body 스키마에 `exclude_managed_channels` 추가 + 구조분해에 `exclude_managed_channels = true` 기본값 추가(컬럼 기본값 1과 일치).
- **검증**: 백엔드 재시작 후 X봇 추가 1건 → 정상 생성 확인.

### 1-2. 죽은/깨진 API 제거
- **파일**: `frontend/src/api/admin/schedules.js`, `frontend/src/api/public/schedules.js`, `frontend/src/hooks/common/useMemberData.js`(+ `hooks/common/index.js`), `frontend/src/api/client.js`(JSDoc)
- **문제**: `createSchedule`/`updateSchedule`(백엔드 라우트 없음, 미사용), `useMemberDetail`→`getMemberByName`(미정의, 호출 시 throw).
- **변경**: 미사용 함수/훅 삭제. export 정리.
- **검증**: `grep`으로 참조 0 확인 + 프론트 빌드(HMR) 에러 없음.

### 1-3. `/api/bots` 정보 노출
- **파일**: `backend/src/app.js`(또는 해당 라우트), 프론트 `api/admin/bots.js`
- **선행 확인**: 프론트가 `/api/bots`를 `fetchAuthApi`(토큰)로 부르는지 `fetchApi`로 부르는지 확인.
  - 토큰으로 부르면 → 라우트에 `preHandler: [fastify.authenticate]` 추가.
  - 토큰 없이 부르면 → 인증 추가 시 관리자 페이지가 깨지므로, 우선 응답에서 `errorMessage` 등 민감필드만 제거.
- **검증**: 관리자 봇 페이지 정상 로드 + 무인증 호출 시 민감정보 미노출 확인.

### 1-4. 방어 코드 2종 (덤)
- **스케줄러 JSON.parse 가드** — `backend/src/plugins/scheduler.js`: `weekly_schedule_config`/`title_filters`/`default_member_ids`/`auto_schedule_config`/`text_filters` 파싱을 `safeParse(value, fallback)`로 감싸 깨진 값 하나가 `startAll` 전체를 막지 않도록.
- **YouTube fetch 타임아웃** — `backend/src/services/youtube/api.js`: `og.js`의 `AbortController` + `setTimeout` 패턴 적용(업스트림 행 방지).
- **검증**: 백엔드 재시작 후 봇 정상 기동, YouTube 동기화 로그 정상.

**커밋**: `fix: 웨이브1 버그·보안 핫픽스 (X봇 크래시/죽은 API/정보노출/방어코드)` — 항목별로 나눠 커밋해도 됨.

---

## 웨이브 2 — 체감 성능 (가성비 최고)

모바일 일정 페이지의 "필터/스크롤마다 전체 리렌더 + 날짜 스트립 재스크롤" 제거.

### 2-1. `selectedDate` 객체 안정화
- **파일**: `frontend/src/pages/mobile/schedule/Schedule.jsx:40` (PC도 동일 패턴 있으면 함께)
- **변경**: `const selectedDate = storedSelectedDate || new Date()` → `useMemo(() => storedSelectedDate || getTodayKST_Date(), [storedSelectedDate])` 또는 스토어 초기값을 오늘로 시드. (다수 `useMemo`/effect의 의존성이라 매 렌더 재실행 원인)
- **검증**: 렌더 시 `daysInMonth`/`selectedDateSchedules` 재계산·`scrollIntoView` 반복이 사라지는지(React DevTools 또는 동작 체감).

### 2-2. 카드 `onClick` memo 복구
- **파일**: 모바일 `Schedule.jsx`(887/907/925), PC `Schedule.jsx`(589/593/621/625/645), 관련 카드 컴포넌트
- **변경**: 인라인 `onClick={() => navigate(...)}` 제거. 카드가 `onClick(schedule)`을 호출하도록 시그니처 통일하고, 페이지에서 `useCallback`으로 안정적 핸들러 1개 전달. PC `handleScheduleClick`도 `useCallback`.
- **검증**: 필터 토글·스크롤 시 카드들이 불필요하게 리렌더되지 않는지 확인(엔트런스 애니메이션 재생 안 됨으로 체감).

**커밋**: `perf(mobile-schedule): selectedDate 안정화 + 카드 onClick memo 복구`

---

## 웨이브 3 — 캐시 (신중히, 단독)

### 3-1. 월별 일정 캐시 + 무효화
- **파일**: `backend/src/services/schedule.js`(getMonthlySchedules), `backend/src/routes/schedules/index.js`, `backend/src/utils/cache.js`
- **변경**: `getMonthlySchedules`를 `getOrSet(redis, cacheKeys.scheduleMonthly(y,m), fn, TTL.MEDIUM)`로 래핑.
- **핵심**: 일정 **생성/수정/삭제 경로 전부**(events/variety/concert/x/youtube/bot sync/삭제)에서 해당 월 캐시 무효화(`invalidatePattern(redis,'schedule:monthly:*')`) 호출 누락 없이 추가. ← 이게 빠지면 stale 발생.
- **검증**: 일정 추가/수정/삭제 후 캘린더 즉시 반영 확인. 캐시 적중 시 응답 빨라지는지 확인.

**커밋**: `perf(schedule): 월별 일정 Redis 캐시 + 쓰기 시 무효화`

---

## 보류 (지금 안 함 — 버그/보안 아님, 유지보수 부채)

> 당장 깨지는 문제가 아니므로 **해당 영역을 어차피 만질 때 곁들여** 처리 권장.
> "같은 수정을 두 군데 반복하게 돼 짜증날 때"가 착수 신호.

### A. 중복 제거 (비용 가장 큼)
- **일정 타입별 CRUD 공통화** — events/variety/concert/x/youtube가 "schedules insert + members + 이미지 저장 + meili 동기화"를 각자 복붙. 공통 `scheduleCore`(createBase/updateBase/setMembers/saveImage)로 추출. *(미완성 generic `/admin/schedules` 경로 정리도 함께)*
- **봇 라우트 3종(festival/x/youtube) CRUD 팩토리화** — formatRow·GET·POST·UPDATE빌더·DELETE가 거의 동일 → `createBotRoutes()` 팩토리
- **PC/모바일 카드 공통 파생 훅** — `ScheduleCard`/`BirthdayCard`/`DebutCard`의 날짜·카테고리·멤버 계산을 `useScheduleCardData(schedule)`로, JSX만 플랫폼별 유지
- **모바일 `ScheduleDetail.jsx`(1304줄) → `sections/` 분리** (PC `sections/` 구조와 일치시켜 이중 관리 해소)
- **`getActiveMemberCount` 중복 통합**(4곳), 멤버 API 모듈 이중화(admin/members.js vs public/members.js) 정리

### B. 거대 컴포넌트 분리
- admin `Schedules.jsx`, 봇 다이얼로그(`YouTubeBotDialog` 912줄 등) — 데이터/UI 관심사 분리

### C. 일관성·정리
- **React Query 캐시 키 팩토리 중앙화**(`['members']` vs `["members"]` 등) + 공통 데이터 훅(`useScheduleData` 등) 실제 사용
- **에러 핸들링 컨벤션 통일** — `reply.code().send({error})` 직접 vs `utils/error.js` 헬퍼 혼용 → 헬퍼로 통일
- **타임존(KST) 처리 통일** — `getTodayKST` vs 로컬 `new Date()` 혼용
- **미완성 legacy `ScheduleForm` 제거** (죽은 generic 경로 관련)
- 매직넘버/Nitter URL `config`로 이전, JSON 컬럼 파싱 `parseJsonColumn` 유틸화
- React key에 index 사용 지양(특히 PC 검색 추천), `getScheduleDetail`의 `s.*` → 필요 컬럼만 명시

### D. 안전·견고성 (소규모)
- 멤버 PUT 트랜잭션화, `saveTweet` `post_id` UNIQUE + `ER_DUP_ENTRY` catch *(스키마 변경 동반)*
- suggestions 수동 `fetch`에 `AbortController`(언마운트 후 setState 방지)
- JWT 수명 단축, CORS 불필요한 `credentials:true` 제거, Gemini 키 쿼리스트링 → 헤더

---

## 진행 현황
- [x] 웨이브 1 (X봇 버그/죽은 API/정보노출/JSON가드/fetch 타임아웃)
- [x] 웨이브 2 (selectedDate 안정화 + 카드 onClick memo 복구)
- [x] 웨이브 3 (월별 일정 Redis 캐시 TTL 60s + 쓰기 시 무효화)
