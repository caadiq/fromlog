# 프롬로그(fromlog) 프로젝트

K-pop 그룹 프로미스나인 팬사이트

## 기술 스택

- **Frontend**: React 18, Vite, Tailwind CSS, React Query, Zustand
- **Backend**: Fastify, MySQL2, Meilisearch, Redis, AWS S3
- **Infrastructure**: Docker, Caddy

## 개발 환경

```bash
docker compose up -d --build
docker compose logs -f fromlog-frontend
```

## 환경 변수

DB 및 외부 서비스 접근 정보는 `.env` 파일 참조:
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (MariaDB)
- RUSTFS_* (S3 호환 스토리지)
- YOUTUBE_API_KEY
- MEILI_MASTER_KEY (Meilisearch)
- KAKAO_REST_KEY (카카오맵 장소 검색)
- GEMINI_API_KEY (대학 축제 크롤러 봇)

## 문서

- [docs/architecture.md](docs/architecture.md) - 프로젝트 구조
- [docs/api.md](docs/api.md) - API 명세
- [docs/development.md](docs/development.md) - 개발/배포 가이드
- [docs/logs.md](docs/logs.md) - 활동 로그 시스템

## 작업 시 주의사항

- **문서 업데이트 필수**: 작업이 완료되면 항상 `docs/` 폴더의 관련 문서를 업데이트할 것
- **활동 로그 필수**: 새로운 관리자 라우트나 봇 기능을 추가할 때 `logActivity` 호출을 포함할 것 (자세한 사용법은 `docs/development.md` 참조)
