# 일정 검색 비교 실험

운영 Meilisearch를 교체하거나 설정을 바꾸지 않는 수동 실험 환경입니다. OpenSearch 3.9.0 + analysis-nori, 운영과 같은 Meilisearch 1.34.0을 **별도 내부 Docker 네트워크**에 실행합니다. 호스트 포트·공개 도메인은 열지 않습니다. 인증을 끈 실험 환경이므로 운영 네트워크에 연결하거나 외부로 공개하지 마세요.

## 현재 상태

- 2026-10-15: 두 실험 컨테이너 실행 중. 일정 2,423건의 스냅샷으로 62개 평가 조건과 접두어/초성 4개 탐색 비교 완료.
- 서비스·봇은 기존 Meilisearch를 계속 사용합니다. 실험 인덱스에는 실시간 동기화가 없으며 API/UI 전환도 없습니다.
- [결과 및 판단](../../docs/validation/search-comparison-2026-10-15.md), [평가 결과 JSON](../../docs/validation/search-comparison-2026-10-15.json).
- 메모리 제한은 서비스마다 2GiB/CPU 2개, OpenSearch JVM heap 1GiB. 실험 종료 시 아래 중지 명령으로 자원을 반환할 수 있습니다.

## 재현

호스트 Python 3 표준 라이브러리와 Docker만 사용합니다. `benchmark.py`는 Docker inspect로 내부 IP를 찾아 호스트에서 연결합니다. Linux Docker bridge 환경 기준이며 Docker Desktop에서는 별도 runner 구성이 필요합니다.

```bash
cd /docker/fromlog
docker compose -p fromlog-search-lab -f tools/search-lab/compose.yml up -d --build
# Meilisearch와 OpenSearch의 시작 완료 후 실행합니다.
docker exec fromlog-search-lab-opensearch curl -fsS http://localhost:9200/_cluster/health
docker exec fromlog-search-lab-opensearch curl -fsS 'http://localhost:9200/_cat/plugins?v'

mkdir -p tools/search-lab/output/current
# 출력에는 일정 데이터·색인 설정만 포함합니다. 키/계정 정보는 출력하지 않습니다.
docker exec -i fromlog-backend node --input-type=module < tools/search-lab/export.mjs > tools/search-lab/output/current/snapshot.json
docker exec -e LAB_CASES="$(cat tools/search-lab/cases.json)" -i fromlog-backend node --input-type=module < tools/search-lab/export-keyboard.mjs > tools/search-lab/output/current/keyboard.json
python3 tools/search-lab/benchmark.py --snapshot tools/search-lab/output/current/snapshot.json --keyboard tools/search-lab/output/current/keyboard.json --output tools/search-lab/output/current/results.json
python3 tools/search-lab/raw-latency.py > tools/search-lab/output/current/raw-latency.json
# 이 명령은 실험 컨테이너 두 개만 재시작합니다. 부하 측정과 동시에 실행하지 않습니다.
python3 tools/search-lab/check-lifecycle.py > tools/search-lab/output/current/lifecycle.json
```

- 최초 벤치마크는 `lab-*` 인덱스를 새로 만듭니다. 재실행은 기존 실험 인덱스를 덮어쓰므로, 다른 평가를 병행하지 않습니다.
- 데이터/분석기 설정이 같고 질의 코드만 비교할 때 `--skip-index`로 재색인을 건너뛸 수 있습니다. 분석기/매핑을 바꿨다면 반드시 재색인합니다.
- `--probes 워크 계약결 ㄱㅇㄱㅎ`는 채점 없이 추가 검색어의 상위 20개 ID를 출력합니다(`--skip-index`와 함께 사용).
- 같은 날짜의 결과를 재현하려면 `output/2026-10-15/snapshot.json`과 `keyboard.json`을 사용합니다. 스냅샷과 상세 노드 통계는 Git 제외 대상입니다.
- 실제 사용자 검색 API를 반복 호출하지 않으므로 검색어 학습 테이블·봇·DB 일정에 쓰지 않습니다.

## 평가 구성

- `cases.json`: 프로그램명/띄어쓰기/조사/약칭/오타/영문/영문 자판/메타데이터/복합 조건/날짜·분류 필터/정답 없는 검색. 추가 평가 17건은 `split: holdout`으로 구분합니다. 조정 중 기존 학교명 확장을 보존하는 누락을 수정했으므로 엄격한 블라인드 평가로 해석하지 않습니다.
- `aliases.json`: 예시 약칭 사전. 두 개선 후보에 같은 약칭을 적용합니다. 운영 사전으로 채택한 것이 아닙니다.
- 현재 기준은 운영 인덱스 문서/설정을 복제하고 검색어 확장·0.5 점수 기준·날짜 보조 정렬·결과 병합을 재현합니다. DB 상세 재조회·HTTP API·브라우저 시간은 포함하지 않습니다.
- `meili_enriched`: 현재 검색 방식 유지, 설명/방송사와 NFC 정규화만 보완한 대조군.
- `meili_tuned`: 같은 보완 데이터 + 별칭 + 숫자 오타 금지 + 모든 단어 일치, 결과가 없는 단일 검색어는 기존 방식으로 재시도 + 서버 필터/20건 제한. 기존 학교명 확장도 유지합니다.
- `nori_basic`: 기존 데이터만, 기본 Nori 분석·AND 검색. 별칭/오타/부분 문자열 보완 없음.
- `standard_tuned` / `nori_tuned`: 같은 보완 데이터·별칭·학교명 확장, 필드 가중치·문구 일치·문자 부분 일치, 결과가 없을 때 영문 자판 및 오타 재시도. Nori 효과를 분리하기 위해 본문 분석기만 standard/한국어로 비교합니다. 고유명사는 standard 보조 필드도 함께 사용합니다.
- 정답은 정규화한 키워드/명시적 별칭 AND 규칙으로 생성하며 제목 3/출처 2/설명 1점입니다. 모든 결과의 사람 채점이나 멤버 출연 여부 추론은 아닙니다. 예: 제목에 성 없이 `지원`만 있는 결과는 `박지원이`의 정답 규칙에서 빠질 수 있습니다. 점수는 이 제한된 평가 집합에 대한 상대 비교용입니다.
- `nDCG@10`: 관련도가 높은 결과가 위에 오는지, 0~1. `hit5`: 상위 5개에 정답 존재. `p5_normalized`: 정답이 5개 미만이면 그 개수로 분모 보정(표준 P@5 아님). `recall_all`: 규칙상 정답을 얼마나 찾는지. 정답 없는 검색은 별도 집계합니다.
- 단일 요청 측정은 62조건 × 6회 × 6후보, 고정 seed로 순서를 섞습니다. 동시 요청은 후보마다 4 workers × 62조건 × 4회. `raw-latency.py`는 별도로 검색 엔진에 한 번 요청해 20개 ID만 받는 대조 실험입니다.

## 관리

```bash
# 중지: 데이터 유지
docker compose -p fromlog-search-lab -f tools/search-lab/compose.yml stop
# 재개
docker compose -p fromlog-search-lab -f tools/search-lab/compose.yml start
# 컨테이너/네트워크 제거, 데이터 볼륨은 유지
docker compose -p fromlog-search-lab -f tools/search-lab/compose.yml down
```

노드/샤드 장애, 장기 운영 안정성, 대량 데이터 확장성, 실사용 클릭 기반 A/B 테스트는 이번 단일 노드·소규모 테스트로 확인하지 않았습니다. 운영 전환을 결정한다면 증분 동기화·전체 재색인·실패 재시도·봇/관리자 연동·한국어 오타 보완을 별도 구현해야 합니다.

공식 참고: [Docker 구성](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/docker/), [analysis-nori 설치](https://docs.opensearch.org/latest/install-and-configure/plugins/), [다중 필드 검색](https://docs.opensearch.org/latest/query-dsl/full-text/multi-match/), [Meilisearch 오타 허용](https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings).
