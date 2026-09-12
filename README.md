# 리딩버디 (Reading Buddy)

초등 쌍둥이 자녀가 대화(음성/채팅)와 사진 촬영만으로 독서 기록을 남기고, '독서로'(read365.edunet.net) 등록도 쉽게 도와주는 가족용 PWA.

전체 요구사항은 [docs/PRD.md](docs/PRD.md) 참고. 자매 앱 `twin_choice`(같은 쌍둥이 자녀 대상 선택 기록 앱)와 인증/프로필 스키마를 공유하도록 설계했다(PRD 4.1).

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router) + TypeScript + Tailwind CSS, 모바일 웹(PWA)
- **백엔드/API**: Next.js API 라우트(`src/app/api/**`) 하나로 통일 — 별도 Supabase Edge Functions/Azure Functions는 쓰지 않음
- **DB/인증/스토리지**: Supabase (Postgres, Auth, Storage) — 무료 티어
- **AI**: Azure OpenAI(단계별 질문 코칭 + 감상문 3단 구성 생성), Azure AI Speech(STT), Azure AI Document Intelligence(OCR, 독서노트/표지 인식)
- **도서 정보**: 카카오 + 도서관정보나루(국립중앙도서관 공공데이터) 도서 검색을 동시에 조회해서 합침(그림책/동화책이 한쪽에만 있는 경우가 많아서 병행, 네이버는 API 종료로 코드만 유지) — 없는 출처는 그냥 빠지고 나머지만으로 계속 동작(선택적 기능). 검색 결과가 0건이면 AI로 오타를 한 번 교정해 재검색한다(`src/lib/bookSearch.ts`)
- **'독서로' 연동**: 수동 등록 가이드(복사·바로가기·완료 표시) — 이용약관상 자동화 허용 여부 미확인이라 완전 자동화(크롤링)는 만들지 않음
- **배포**: Vercel (아래 "배포" 섹션 참고)

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev
```

### 테스트

```bash
npm run test         # 한 번 실행
npm run test:watch   # watch 모드
```

외부 의존성(Supabase/Azure/카카오 등) 없이 순수하게 계산만 하는 로직(PIN 검증/잠금, 단계별
질문 폴백, 배지 계산, 통계 집계, 도서 검색 결과 중복 제거, 기록 검색어 이스케이프 등)만
유닛 테스트(`src/lib/*.test.ts`, `src/components/*.test.ts`)로 다루고, Next.js 서버 컴포넌트/
API 라우트/RLS 같은 통합 동작은 지금까지처럼 실제 브라우저로 수동 검증한다(각 Phase 항목의
CLAUDE.md 기록 참고). 현재 9개 파일 54개 테스트. `server-only`로 막힌 모듈을 테스트에서
import할 수 있도록 `vitest.config.mts`가 그 패키지를 빈 모듈(`test/stubs/server-only.ts`)로
치환해둔다.

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
   - `0007_avatar_photo.sql` — 자녀 아바타 사진용 비공개 스토리지 버킷(`avatars`) + `profiles.avatar_photo_path` 컬럼
   - `0008_drop_dokseoro_credentials.sql` — 쓰이지 않는 `dokseoro_credentials` 테이블 제거('독서로' 연동은 수동 등록 가이드로 확정, 위 "'독서로' 연동" 참고)
   - `0009_custom_stage_instructions.sql` — 부모가 AI의 단계별 질문 지침을 가족 단위로 바꿀 수 있는 `families.custom_stage_instructions` 컬럼
   - `0010_page_count.sql` — 책 페이지 수를 기록하는 `conversation_sessions.book_page_count`/`reading_records.page_count` 컬럼(도서 검색 API가 페이지 수를 제공하지 않아 사람이 직접 입력)
4. `CHILD_AUTH_SECRET`은 `openssl rand -hex 32`로 생성

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

### 도서 검색 API 셋업

카카오는 필수, 나머지는 선택(없어도 카카오만으로 계속 동작하지만, 그림책/동화책은 한쪽에만 있는 경우가 많아 등록하는 걸 권장):

1. **카카오**: [Kakao Developers](https://developers.kakao.com) 로그인 → 앱 생성 → "앱 키"의 REST API 키를 `KAKAO_REST_API_KEY`에 복사
2. **네이버**(선택, 2026-09 기준 신규 발급 불가): 네이버 도서/쇼핑/전문자료 검색 오픈API가 2026-07-31부로 완전 종료돼서, `developers.naver.com` 애플리케이션 등록 화면의 "사용 API" 목록에 "검색" 자체가 더 이상 없다. `src/lib/naverBook.ts`는 예전에 발급받은 키가 있는 경우를 위해 남겨뒀지만, 새로 시도할 필요는 없다.
3. **도서관정보나루**(선택): 국립중앙도서관이 운영하는 공공 오픈데이터(data4library.kr) — 네이버/알라딘 도서 검색이 둘 다 종료되면서 대신 추가함. 전국 공공/학교 도서관 소장 데이터라 절판/오래된 그림책도 잘 걸리는 편이나, 줄거리 설명은 제공하지 않는다(표지 이미지만).
   - [data4library.kr](https://www.data4library.kr) 회원가입 → "데이터활용 > 인증키발급"
   - 사용목적 **"앱 개발(모바일, 솔루션 등)"** 선택
   - 서버 IP는 하루 500건 넘게 호출하지 않는 한 비워둬도 됨(Vercel 서버리스는 고정 IP가 없어서 어차피 등록할 게 없음)
   - 사용기관명/사용용도는 자유롭게 입력(예: "개인용" / "초등 자녀용 독서 기록 앱에서 책 제목 검색·자동완성 기능에 사용합니다.")
   - 발급된 인증키를 `DATA4LIBRARY_AUTH_KEY`에 복사 — 신청 직후 "승인대기중" 상태로 뜰 수 있음(승인 전엔 호출이 안 될 수 있어서, 승인되면 그때 실제 검색이 반영됨)

Vercel에 배포 중이라면 위에서 등록한 키들을 Vercel 프로젝트의 Environment Variables에도 추가해야 프로덕션에 반영된다.

### 배포 (Vercel)

**프로덕션**: https://reading-buddy-ten.vercel.app (Vercel 프로젝트 `teddy706s-projects/reading-buddy`)

1. [vercel.com/new](https://vercel.com/new) → GitHub의 `reading-buddy` 저장소 Import (Next.js 자동 인식, 별도 설정 불필요)
2. "Environment Variables" 섹션에서 `.env.local`의 모든 변수(17개, `ALADIN_API_KEY` 제외 — 미사용)를 "paste the .env contents"로 한 번에 붙여넣기. Environments는 기본값(Production and Preview) 유지
3. Deploy. 이후 `main` 브랜치에 push할 때마다 Vercel이 자동으로 재배포함(별도 CI 설정 불필요)
4. 로컬 코드에 localhost 하드코딩이 없어(미들웨어/쿠키는 요청 host 기준으로 동작) 배포 시 추가 코드 수정 불필요했음

### 인증 구조 (중요)

Supabase Auth로 로그인하는 건 **부모뿐**이다. 자녀는 부모 로그인 세션 안에서 프로필(PIN)로 전환하지만, 내부적으로는 `child+{profileId}@child.reading-buddy.internal` 형태의 synthetic 계정으로 실제 Supabase Auth 세션을 발급받는다(`src/lib/childAuth.ts`). 그래야 `auth.uid()` 기반 RLS가 "같은 가족인가"뿐 아니라 "쌍둥이 중 누구의 프로필인가"까지 DB 레벨에서 강제된다. 자세한 배경은 [CLAUDE.md](CLAUDE.md)와 [docs/PRD.md](docs/PRD.md) 9.1 참고.

## 프로젝트 구조

```
src/
  app/
    (auth)              /login, /signup, /profiles, /profiles/[id]/pin, /profiles/new
    home/               자녀 홈 — 새 기록 시작, 내 배지, 최근 기록
    read/                /read/new(방식 선택) → new/book(대화) | ocr/new(사진) → [id]/chat, [id]/review 등
    records/            자녀 본인 기록 히스토리/상세 (/records, /records/[id])
    settings/           부모 전용 — children/records/stats/badges
    api/                Next.js API 라우트로 통일된 백엔드 (auth, children, reading-sessions,
                        ocr-uploads, reading-records, book-cover-lookup, speech/transcribe)
  lib/
    supabase/           client.ts(브라우저) / server.ts(RSC) / admin.ts(service role, RLS 우회)
    childAuth.ts         자녀 PIN → synthetic 계정 비밀번호 파생
    azureOpenAI.ts       질문 생성(단계별 코칭)/감상문 생성/OCR·표지 텍스트 구조화
    azureSpeech.ts       음성 답변 STT
    documentIntelligence.ts  OCR (독서노트 사진, 표지 사진 둘 다)
    kakaoBook.ts         책 검색(줄거리 컨텍스트 + 표지 인식 후보 목록)
    readingSession.ts    대화 질문 개수/단계별 프레임워크 규칙 + 팔로업 질문 판정
    coachPresets.ts       AI 질문 코치 프리셋(질문 스타일) 3종
    readingStats.ts      독서 통계 집계 헬퍼
    badges.ts            배지 카탈로그/판정 로직
    siblingReadingCounts.ts  형제자매 비교용 집계 전용 조회(서비스 역할)
    avatarPhoto.ts        아바타 사진 경로 규칙 + 서명된 URL 발급
    bookSearch.ts / libraryBook.ts  도서 검색 다중 소스 조회 + 중복 제거
    recordsPaging.ts      기록 목록 페이지 크기(서버/클라이언트 공용 모듈 — "use client" 금지)
    types.ts             테이블 타입
supabase/
  migrations/           SQL 마이그레이션 (번호 순서대로 적용)
docs/
  PRD.md                제품 요구사항 문서 (구현 중 결정된 사항은 "구현 노트"로 본문에 주석 처리)
  ARCHITECTURE.md       실제 구현 기준 기술 아키텍처 (PRD 6장의 최초 계획과 다른 부분 정리)
  BRIEF.md              프로젝트 5분 요약
  STORIES.md            기능 단위 사용자 스토리 (전부 구현 완료 상태)
```

## 다음 단계

Phase 1의 5개 항목과 Phase 2(A~D)가 모두 구현·테스트 완료됐다: "1. 계정/인증", "2. 대화 기반 독서 기록"(책 정보 입력/자동완성 → 카카오+도서관정보나루 도서 검색으로 줄거리 조회 → 단계별 AI 질문 생성(그라운딩/팔로업 질문 포함) → 텍스트/음성 답변 → 감상문 생성 → 검수(원본 답변 비교, 쓰기 팁) → 저장, `/read/**`), "3. 독서노트 OCR 입력"(`/read/ocr/**`), "5. 기록 관리"(무한 스크롤/검색/날짜 필터, 자녀별 탭, `/records/**`·`/settings/records`), "4. '독서로' 자동 연동"(수동 등록 가이드 버전 — 아래 참고), Vercel 배포, 독서 통계, 표지 촬영 인식, 형제자매 배지. Supabase/Azure 인프라와 도서 검색 API도 모두 실제로 연결 확인까지 마쳤다. 음성 입력은 초기엔 녹음 포맷 문제로 항상 실패했으나 PCM WAV 인코딩으로 교체해 해결됨(상세는 CLAUDE.md 참고).

**"4. '독서로' 자동 연동"은 수동 등록 가이드로 구현했다.** 부모의 실제 '독서로' 로그인이 에듀넷 자체 계정임은 확인했지만, 이용약관상 자동화(크롤링) 허용 여부가 불명확해 Playwright 기반 완전 자동화 대신 수동 가이드를 채택했다(사용자 선택). `/records/[id]`·`/settings/records`의 기록 상세 화면에서 책 제목/날짜/내용을 한 번에 복사하는 버튼, '독서로' 사이트를 새 탭으로 여는 링크, 등록 완료 여부를 사람이 직접 표시하는 토글(`reading_records.dokseoro_status`, 부모 전용)을 제공한다. 완전 자동화는 이용약관 확인 후 필요하면 재검토한다.

**Phase 1/2 완료 이후로도 사용자 피드백 기반 개선이 계속 이어지고 있다** — 책 제목 자동완성, AI 질문 코치 프리셋(`/settings/coach`), 기록 목록 무한 스크롤/검색, 대화 "그만할래"를 취소/다음에 작성으로 분리, 화면별 UI 다듬기, AI 질문이 책 내용과 무관해지는 문제 수정(그라운딩 강화) 및 성의 없는 답변에 대한 팔로업 질문 등. 상세 이력은 [CLAUDE.md](CLAUDE.md)와 [docs/STORIES.md](docs/STORIES.md)를 참고.

**"2. 대화 기반 독서 기록"은 이후 사용자가 설계한 "단계별 독서록 유도 질문 프레임워크"로 고도화했다.** 4개 질문을 1단계 "장면 소환"(줄거리 확인, 2문항) → 2단계 "역할 바꾸기"(공감) → 3단계 "현실 적용"(자기화)으로 고정하고, 감상문은 이 답변들을 처음(줄거리)-가운데(생각)-끝(현실 연결) 3단 구성으로 조립한다. 상세는 [CLAUDE.md](CLAUDE.md)의 2번 항목 참고.

**Phase 2(MVP 이후 로드맵 중 A~D 선택)도 모두 완료됐다.** A(Vercel 배포, 위 "배포" 참고). B(독서 통계/리포트, `/settings/stats`) — 자녀별 누적/이번 달 권수, 최근 6개월 추이 그래프, 기록 방식 비율, '독서로' 반영 현황을 보여준다(장르 분포는 스키마에 없어 미구현). C(표지 촬영 자동 인식) — `/read/new/book`에서 표지 사진을 찍으면 OCR(Document Intelligence, 저장 없이 바이트 직접 전달) → AI 제목 추정 → 카카오 도서 검색 후보 목록을 보여주고 사람이 골라서 확정한다(AI 추정을 자동 확정하지 않음). D(형제자매 비교/배지·스탬프) — 자녀 홈의 "내 배지"(본인 것만)와 부모 전용 `/settings/badges`(두 자녀 나란히 비교)에서 누적 권수·기록 방식·독서로 반영·이달의 다독왕 등 7종 배지를 보여준다. 새 테이블 없이 매번 `reading_records`에서 계산하며, 형제자매 기록은 RLS로 서로 볼 수 없게 막혀 있어 "이달의 다독왕" 비교에 한해서만 집계 전용(책 제목/내용 제외) 서비스 역할 조회를 씀(`src/lib/siblingReadingCounts.ts`). 상세는 [CLAUDE.md](CLAUDE.md)의 체크리스트 참고.
