# 리딩버디 (Reading Buddy)

초등 쌍둥이 자녀가 대화(음성/채팅)와 사진 촬영만으로 독서 기록을 남기고, '독서로'(read365.edunet.net)에 자동 반영하는 가족용 PWA.

전체 요구사항은 [docs/PRD.md](docs/PRD.md) 참고. 자매 앱 `twin_choice`(같은 쌍둥이 자녀 대상 선택 기록 앱)와 인증/프로필 스키마를 공유하도록 설계했다(PRD 4.1).

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router) + TypeScript + Tailwind CSS, 모바일 웹(PWA)
- **DB/인증/스토리지**: Supabase (Postgres, Auth, Storage) — 무료 티어
- **AI**: Azure OpenAI(질문 생성 + 감상문 생성), Azure AI Speech(STT), Azure AI Document Intelligence(OCR)
- **도서 정보**: 알라딘 Open API / 카카오 도서 검색 API
- **'독서로' 자동화**: Azure Functions + 브라우저 자동화(Playwright, 예정)

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev
```

### Supabase 셋업

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 티어)
2. 프로젝트 설정 > API 에서 URL/anon key/service role key를 `.env.local`에 복사
3. `supabase/migrations/*.sql`을 순서대로 SQL Editor에서 실행 (또는 `supabase db push`)
   - `0001_schema.sql` — families/profiles + 독서 기록 도메인 테이블
   - `0002_functions_triggers.sql` — RLS 헬퍼 함수(`my_family_id()` 등)
   - `0003_rls.sql` — Row Level Security 정책
   - `0004_storage.sql` — 독서노트 사진용 비공개 스토리지 버킷
4. `CHILD_AUTH_SECRET`, `DOKSEORO_CREDENTIALS_ENCRYPTION_KEY`는 `openssl rand -hex 32`로 생성

### 인증 구조 (중요)

Supabase Auth로 로그인하는 건 **부모뿐**이다. 자녀는 부모 로그인 세션 안에서 프로필(PIN)로 전환하지만, 내부적으로는 `child+{profileId}@child.reading-buddy.internal` 형태의 synthetic 계정으로 실제 Supabase Auth 세션을 발급받는다(`src/lib/childAuth.ts`). 그래야 `auth.uid()` 기반 RLS가 "같은 가족인가"뿐 아니라 "쌍둥이 중 누구의 프로필인가"까지 DB 레벨에서 강제된다. 자세한 배경은 [CLAUDE.md](CLAUDE.md)와 [docs/PRD.md](docs/PRD.md) 9.1 참고.

## 프로젝트 구조

```
src/
  app/                  App Router 페이지
  lib/
    supabase/           client.ts(브라우저) / server.ts(RSC) / admin.ts(service role)
    childAuth.ts         자녀 PIN → synthetic 계정 비밀번호 파생
    types.ts             테이블 타입
supabase/
  migrations/           SQL 마이그레이션 (번호 순서대로 적용)
docs/
  PRD.md                제품 요구사항 문서
```

## 다음 단계

PRD 10절 기준:

1. 부모의 '독서로' 실제 로그인 방식 확인 (에듀넷 자체 계정 vs SNS 간편 로그인)
2. '독서로' 이용약관 직접 확인 (자동화 가능 범위 최종 확정)
3. MVP 기능 구현 착수 — 우선순위는 [CLAUDE.md](CLAUDE.md)의 "Phase 1 진행 순서" 참고
