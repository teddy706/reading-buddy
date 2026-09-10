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

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 티어). 생성 화면의 Security 섹션에서
   **"Automatically expose new tables"는 꺼도 되지만, 그러면 `0006_grants.sql`이 GRANT를 대신 잡아줘야
   서비스 롤조차 테이블에 접근할 수 있다** — 이 저장소의 마이그레이션에는 이미 포함되어 있음
2. 프로젝트 설정 > API Keys 에서 URL과 publishable(anon) key를 `.env.local`에 복사.
   **service role key는 반드시 "Legacy anon, service_role API keys" 탭의 JWT를 사용할 것** — 새 형식
   secret key(`sb_secret_...`)는 GoTrue admin API(`auth.admin.createUser` 등)에는 동작하지만
   PostgREST의 RLS 우회(`admin.from(...).insert` 등)에는 `role=service_role` JWT가 필요해서 동작하지 않는다
   ("permission denied for table ..." 오류로 나타남)
3. `supabase/migrations/*.sql`을 **번호 순서대로** SQL Editor에서 실행 (또는 `supabase db push`)
   - `0001_schema.sql` — families/profiles + 독서 기록 도메인 테이블
   - `0002_functions_triggers.sql` — RLS 헬퍼 함수(`my_family_id()` 등)
   - `0003_rls.sql` — Row Level Security 정책
   - `0004_storage.sql` — 독서노트 사진용 비공개 스토리지 버킷
   - `0005_pin_lockout.sql` — 자녀 PIN 5회 실패 잠금용 컬럼
   - `0006_grants.sql` — anon/authenticated/service_role 테이블 GRANT (위 1번 참고)
4. `CHILD_AUTH_SECRET`, `DOKSEORO_CREDENTIALS_ENCRYPTION_KEY`는 `openssl rand -hex 32`로 생성

### Azure 셋업

리소스 그룹 하나(예: `RG-reading-buddy`)에 세 개를 만든다 — 전부 Korea Central, Standard S0 권장:

1. **Azure OpenAI**: Azure Portal에서 `azure openai service` 검색 → 만들기. 모델 배포는 클래식 포털이 아니라
   **Foundry 포털**(`ai.azure.com`, 리소스 개요의 "Foundry 포털로 이동")의 "모델 배포 > 기본 모델 배포"에서 한다.
   - `AZURE_OPENAI_QUESTION_DEPLOYMENT`용 저지연 경량 모델(gpt-4o-mini는 단종됨 — Foundry 모델 카탈로그에서 현재 사용 가능한 후속 모델 확인, 2026-09-10 기준 `gpt-5.4-mini`)
   - `AZURE_OPENAI_ESSAY_DEPLOYMENT`용 상위 품질 모델(`gpt-4o`)
   - 배포 후 목록에 "성공"으로 뜨는지 새로고침해서 확인할 것 — Foundry 포털의 "배포" 버튼이 가끔 조용히 실패한다(콘솔에 IndexedDB 오류). 안 뜨면 `curl {endpoint}openai/deployments?api-version=2023-03-15-preview -H "api-key: ..."`로 직접 확인
   - 신형 모델은 채팅 호출 시 `max_tokens` 대신 `max_completion_tokens`가 필요함 (`gpt-4o`는 둘 다 허용)
2. **Azure AI Speech**: 검색이 안 되면 `https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices` 직접 접속
3. **Azure AI Document Intelligence**: 검색이 안 되면 `https://portal.azure.com/#create/Microsoft.CognitiveServicesFormRecognizer` 직접 접속

각 리소스의 "키 및 엔드포인트"에서 값을 `.env.local`에 복사.

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

Phase 1의 "1. 계정/인증"과 "2. 대화 기반 독서 기록"(책 정보 입력 → AI 질문 생성 → 텍스트/음성 답변 → 감상문 생성 → 저장, `/read/**`)은 구현·테스트 완료. Supabase/Azure 인프라도 모두 실제로 생성하고 연결 확인까지 마쳤다. 음성 입력은 자동화 브라우저로는 마이크 테스트가 불가능해서 실제 기기 확인이 아직 안 됐다. 다음은 [CLAUDE.md](CLAUDE.md)의 "Phase 1 진행 순서" 3번(독서노트 OCR 입력)부터.

PRD 10절 기준 별도 확인 필요 사항:

1. 부모의 '독서로' 실제 로그인 방식 확인 (에듀넷 자체 계정 vs SNS 간편 로그인)
2. '독서로' 이용약관 직접 확인 (자동화 가능 범위 최종 확정)
