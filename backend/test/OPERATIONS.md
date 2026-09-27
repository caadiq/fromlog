# 운영 안정성 검사

실제 API 키·운영 DB 자격증명을 주입하지 않는다. 외부 네트워크 없는 MariaDB 11/12.1 + Redis 7과 Node 20 환경을 사용한다. 운영 컨테이너를 정지하거나 장애를 주입하지 않는다.

## 단위 및 의존 서비스 검사

`operations.test.js`는 기본적으로 실제 DB/Redis 검사 4개를 건너뛴다. `OPS_AUDIT_DB=1`이면 loopback MariaDB의 `ops_test`와 Redis 6379가 필요하다. `CLIENT PAUSE`로 테스트 Redis에만 지연을 주입한다.

```bash
# 반드시 격리 DB에 적용
mariadb -e 'CREATE DATABASE ops_test'
mariadb ops_test < sql/20260927-ops-alerts.sql
JWT_SECRET=test FIREBASE_SERVICE_ACCOUNT=/nonexistent OPS_AUDIT_DB=1 npm run test:operations
JWT_SECRET=test npm run test:bots
```

- 캐시 장애/잘못된 JSON, DB 오류 전파, 준비 상태 검사 병합/시간 제한
- 실제 Redis 지연 및 미기동, 봇 상태 임시 저장/복구, 타이머 정리
- YouTube/X/Meilisearch 응답 헤더 이후 본문 지연
- DB 알림 대기열의 실패/부분 성공/재시작/중복 실행/수동 복구 시 취소
- 종료 신호 중복 처리/시간 제한

기존 수집/봇 통합은 [4번 기록](../../docs/validation/04-collection-recovery.md)의 격리 환경으로 실행한다.

## 실제 백업 복원 검사

운영과 같은 MariaDB **12.1.2**의 격리 인스턴스를 준비한다. 11.x는 이 백업의 테이블별 외래키 이름을 호환하지 못한다. 네트워크는 `none`, 포트를 호스트에 공개하지 않는다.

```bash
python3 test/fixtures/extract-fromlog-backup.py /private/mariadb-YYYYMMDD.sql.gz /private/fromlog.sql
# 아래 명령은 격리 DB에만 실행
mariadb < /private/fromlog.sql
mariadb-check --databases fromlog
```

복원 검사 프로세스는 그 DB의 network namespace를 공유하고 `DB_HOST=127.0.0.1 DB_USER=root DB_NAME=fromlog REDIS_HOST=127.0.0.1 MEILI_HOST=http://127.0.0.1:7700 TRUSTED_PROXY_HOSTS= JWT_SECRET=test FIREBASE_SERVICE_ACCOUNT=/nonexistent OPS_RESTORE_DB=1 npm run test:operations:restore`로 실행한다. Redis/검색 서버가 없어도 공개 DB 조회가 가능함과 모든 외래키의 고아 행 부재를 검사한다. 봇 `startAll()`은 호출하지 않는다.

## 실제 종료 신호

`test/fixtures/shutdown-worker.js`를 `/audit` 임시 출력 폴더와 함께 `--init --stop-timeout 25` 컨테이너에서 `node --watch`로 실행한다. `shutdown-ready` 확인 후 그 테스트 컨테이너만 종료한다. 종료 코드 0 및 `shutdown-completed`가 실제 SIGTERM 전달/비동기 종료 완료의 근거다.

[검증 결과·한계](../../docs/validation/12-operations.md)를 참고한다. 백업 SQL·복원 데이터·자격증명은 Git에 추가하지 않는다.
