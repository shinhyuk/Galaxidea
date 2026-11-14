# Galaxidea

내 아이디어는 우주 어디쯤에 있을까.

아이디어를 한 줄로 물으면 세계에서 누가 먼저 생각했고 어디까지 진행했는지 알려 주고, 그 질문이 다음 사람을 위한 기록(별)이 되는 웹 서비스입니다.

전체 기획과 진행 순서는 [SPEC.md](SPEC.md)에 있습니다. 현재 상태는 M2(깃허브 수집과 임베딩 적재)까지 끝났습니다.

## 시작하기

```bash
cp .env.example .env.local   # 값 채우기
docker compose up -d         # Postgres + pgvector, 첫 실행 때 스키마 적용
npm install
npm run dev
```

- 화면: http://localhost:3000
- 상태 확인: http://localhost:3000/api/health

## 화면 시안 (더미 데이터)

홈(`/`), 보고서(`/q/1`, `/q/2`, `/q/3`), 영역 상세(`/c/idea` 등)는 지금 `lib/mock.ts`의 지어낸 데이터로 그려집니다. 실제 검색과 연결하는 일은 M3, M4에서 합니다.

## 구조

- `app/` Next.js 화면과 API
- `lib/env.ts` 환경변수와 판정 기준 상수
- `db/migrations/` 스키마
- `scripts/` Python 배치(수집, 주간 계산)
- `docs/demo.html` 우주 지도 시연 화면

## 호스팅 DB 적재

실제 DB는 Supabase(Postgres + pgvector)에 있고, GitHub Actions의 "Collect GitHub items" 작업으로 적재합니다. 저장소 Secret `DATABASE_URL`, `EMBED_API_KEY`가 필요합니다. 2026-11-14 첫 실행에서 별 2,000 이상 33,534건을 적재하고 1,000건을 임베딩했습니다. 나머지는 `embed_limit`을 `0`으로 두고 다시 실행하면 채워집니다.
