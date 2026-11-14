# Galaxidea

내 아이디어는 우주 어디쯤에 있을까.

아이디어를 한 줄로 물으면 세계에서 누가 먼저 생각했고 어디까지 진행했는지 알려 주고, 그 질문이 다음 사람을 위한 기록(별)이 되는 웹 서비스입니다.

전체 기획과 진행 순서는 [SPEC.md](SPEC.md)에 있습니다. 현재 상태는 M1(저장소 골격)입니다.

## 시작하기

```bash
cp .env.example .env.local   # 값 채우기
docker compose up -d         # Postgres + pgvector, 첫 실행 때 스키마 적용
npm install
npm run dev
```

- 화면: http://localhost:3000
- 상태 확인: http://localhost:3000/api/health

## 구조

- `app/` Next.js 화면과 API
- `lib/env.ts` 환경변수와 판정 기준 상수
- `db/migrations/` 스키마
- `scripts/` Python 배치(수집, 주간 계산)
- `docs/demo.html` 우주 지도 시연 화면

## 아직 확인하지 않은 것

- `docker-compose.yml`과 `db/migrations/001_init.sql`은 작성만 했고 실제 Postgres에서 실행해 보지 않았습니다. 처음 띄울 때 오류가 나는지 확인하세요.
