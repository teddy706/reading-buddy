# CLAUDE.md — 리딩버디 (독서 기록 앱)

이 파일은 프로젝트 루트에 두고 Claude Code가 매 세션 시작 시 참고하는 컨텍스트 문서입니다. **Phase 1의 5개 항목이 모두 구현·실제 브라우저 테스트 완료되었습니다("4. '독서로' 자동 연동"은 사용자가 명시적으로 선택한 "수동 등록 가이드" 버전으로 완료 — Playwright 자동화는 만들지 않음, 아래 4번 항목 참고).**

## 프로젝트 개요

초등 3학년 쌍둥이 자녀가 '독서로'(read365.edunet.net)에 독서 기록을 남겨야 하는데, PC 중심 UI와 텍스트 감상문 작성 부담 때문에 실제 독서량 대비 기록량이 적다. 아이가 부담 없이 참여할 수 있는 방식(대화, 사진 촬영)으로 기록의 진입장벽을 낮추고, 모인 기록을 '독서로'에 자동 반영하는 것이 목표.

- **전체 요구사항**: [docs/PRD.md](docs/PRD.md)
- **자매 앱**: `twin_choice`(같은 쌍둥이 자녀 대상 "선택 기록" 앱) — 인증/프로필 스키마와 패턴을 그대로 재사용 중 (PRD 4.1의 멀티 앱 확장 전략)

## 확정된 기술 결정 (재논의 불필요)

| 항목 | 결정 |
|---|---|
| 배포 형태 | PWA (네이티브 앱 아님) |
| 프론트엔드 | Next.js 14 (App Router) + React + Tailwind CSS |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Storage), 무료 티어 |
| 인증 — 부모 | Supabase Auth 이메일 로그인. **유일한 정식 로그인 주체** |
| 인증 — 자녀 | 이메일 없음. `profile_id + 4자리 PIN` → family 코드로 특정한 뒤, PIN에서 결정론적으로 파생한 비밀번호(`src/lib/childAuth.ts`)로 synthetic 이메일 계정에 로그인해 **실제 Supabase Auth 세션**을 발급(`role`은 JWT 클레임이 아니라 `profiles.role` 컬럼으로 판별). PRD 9.1은 "PIN은 보안 경계가 아니다"라고 봤지만, twin_choice 패턴을 재사용해 실제로는 자녀 단위까지 RLS로 강제된다 — 자세한 배경은 docs/PRD.md 9.1의 "구현 노트" 참고 |
| 권한 분리 | 프론트엔드 라우팅 차단 + **RLS(Row Level Security)로 DB 레벨 차단**이 필수. 프론트엔드만으로 막지 않음 |
| AI — 질문 생성 | Azure OpenAI 저지연 경량 모델(`AZURE_OPENAI_QUESTION_DEPLOYMENT`) — 대화 흐름이 끊기지 않도록 응답 속도 우선. gpt-4o-mini는 단종되어 실제로는 `gpt-5.4-mini`를 배포함(2026-09-10 기준). 이 "경량 모델" 자리는 시점마다 후속 모델로 계속 바뀔 수 있으니 배포 전 Foundry 모델 카탈로그에서 현재 사용 가능한 모델을 확인할 것 |
| AI — 감상문 생성 | Azure OpenAI 상위 품질 모델(`AZURE_OPENAI_ESSAY_DEPLOYMENT`, 실제 배포: `gpt-4o`) — 세션당 1회 호출이라 속도보다 문장 품질 우선 |
| AI 생성 감상문 윤리 | 아이가 답변하지 않은 내용을 임의로 창작하지 않는다. 감상문은 아이 답변의 재구성이며, 원본 대화 로그(`conversation_sessions.messages`)를 항상 함께 보관해 부모가 대조 확인 가능하게 함 |
| 책 정보 조회 | 카카오 도서 검색 API(`src/lib/kakaoBook.ts`)로 줄거리 요약만 가져와 질문 생성 프롬프트 컨텍스트로 사용. 조회 실패/결과 없음은 에러 없이 null 처리(제목/저자만으로 폴백). **AI 내장 웹검색 도구는 호출당 토큰 비용이 커서 사용하지 않음** (PRD 6.4). 알라딘은 미연동(카카오만으로 충분 판단) |
| 비용 정책 | Supabase는 무료 티어 유지, Azure AI는 월 $150 예산 내에서 Standard(S0) 등 유료 티어를 품질 우선으로 사용 (PRD 6.5) |
| 확장성 원칙 | 전 테이블 `family_id` 기반. 코드에 "가족은 하나뿐"이라는 가정(하드코딩된 family_id, 환경변수 등)을 절대 심지 않을 것 |
| PIN 잠금 정책 | 5회 연속 실패 시 1분 잠금(`profiles.pin_fail_count`/`pin_locked_until`, `src/lib/childAuth.ts`의 `PIN_MAX_ATTEMPTS`/`PIN_LOCK_DURATION_MS`). PRD 3.1 확정 사항 — twin_choice에는 없는 재량 추가 |
| 프로필 전환 후 "나가기" | PIN 성공 시 부모 세션이 자녀 synthetic 세션으로 완전히 교체된다(9.1 구현 노트). 자녀 홈의 "나가기"는 세션을 완전히 로그아웃시키고 `/login`으로 보낸다 — 부모는 이메일/비밀번호를 다시 입력해야 부모 모드로 돌아온다. 매번 재로그인해야 하는 게 불편하면 "부모 비밀번호만 다시 묻는 가벼운 게이트"로 바꾸는 걸 고려할 수 있으나, 현재는 완전 재로그인이 가장 단순하고 안전한 기본값으로 채택됨 |

## 확정 안 된(추가 확인 필요) 사항

- '독서로' 이용약관상 자동화(크롤링) 허용 여부 — 공공 교육 플랫폼이라 금지 가능성 있음. 아래 Phase 1 4번 참고: 이 확인 전까지는 자동 연동을 만들지 않고 "수동 등록 가이드"만 제공하기로 함.

## 현재 상태: 개발 사전 셋업 완료 (Phase 0)

- [x] Next.js 14 + TS + Tailwind + App Router 스캐폴딩
- [x] Supabase client/server/admin 클라이언트 (`src/lib/supabase/`)
- [x] 자녀 PIN → synthetic 계정 인증 헬퍼 (`src/lib/childAuth.ts`)
- [x] DB 스키마/RLS/스토리지 마이그레이션 (`supabase/migrations/0001~0004`)
- [x] `.env.local.example`, README, PRD 문서화
- [x] GitHub private 저장소 생성
- [x] **Supabase 프로젝트 실제 생성 및 마이그레이션 적용 완료** — `teddy706's Org` 조직, 프로젝트명 `reading-buddy`, 리전 ap-northeast-2(Seoul), URL `https://ebtlnygmfmglwxpcqczz.supabase.co`. `.env.local`에 실제 키 반영 완료(gitignored). 테이블 6개 + RLS 정책(families 1/profiles 1/conversation_sessions 3/ocr_uploads 3/reading_records 3) + storage 정책 2개 + `reading-notes` 버킷까지 SQL Editor에서 직접 실행/검증함. `dokseoro_credentials`는 의도대로 정책 0개(완전 차단)
- [x] **Azure 리소스 실제 생성 및 연결 확인 완료** — 전부 리소스 그룹 `RG-reading-buddy`(Korea Central) 아래: `reading-buddy-openai`(Azure OpenAI, 배포 `gpt-4o`/`gpt-5.4-mini` 둘 다 `curl`로 실제 채팅 호출 성공 확인), `reading-buddy-speech`(Azure AI Speech, 토큰 발급 확인), `reading-buddy-docintel`(Document Intelligence, `/documentintelligence/info` 확인). `.env.local`에 전부 반영 완료
- [x] **카카오 도서 검색 API 연동 완료** — Kakao Developers 앱 "리딩버디"(ID 1573541) 생성, REST API 키를 `.env.local`의 `KAKAO_REST_API_KEY`에 반영, `src/lib/kakaoBook.ts`로 대화 질문 생성에 연결(아래 Phase 1 2번 참고). 알라딘은 미연동

## Phase 1 진행 순서 (PRD 5.2 기준)

번호 순서대로 하나씩 진행할 것. 앞 번호가 안 끝났으면 뒷 번호에 먼저 손대지 말 것.

- [x] **1. 계정/인증**: 부모 회원가입/로그인(`/signup`, `/login`), 자녀 프로필 생성 UI(`/profiles/new`), 프로필 선택(`/profiles`) → PIN 입력(`/profiles/[id]/pin`) → 세션 전환 → 자녀 홈(`/home`) 흐름 구현 및 실제 브라우저로 전체 플로우(가입→프로필 생성→PIN 성공/실패/5회 잠금→나가기→재로그인→PIN 재설정)까지 테스트 완료. 부모 설정(`/settings/children`)에서 이름/아바타 수정 + PIN 재설정 가능
- [x] **2. 대화 기반 독서 기록**: `/read/new`(기록 방식 선택, OCR 카드는 비활성) → `/read/new/book`(책 제목/저자 입력) → `/read/[id]/chat`(대화 진행, 텍스트+음성 입력, N/4 진행 표시, "그만할래") → `/read/[id]/review`(감상문 생성/편집, 원본 대화 펼쳐보기, 저장) → `/home`에 반영. `src/lib/azureOpenAI.ts`(`generateNextQuestion`/`generateEssay`, gpt-5.4-mini/gpt-4o, `max_completion_tokens` 사용)와 `src/lib/azureSpeech.ts`(음성 답변 STT, REST 단문 인식 엔드포인트)로 구현. 실제 브라우저로 텍스트 답변 4턴 → 감상문 생성 → 저장까지 end-to-end 확인, DB에 `reading_records`(dokseoro_status=pending) + `conversation_sessions`(status=completed) 생성됨을 SQL로 검증함. **음성 입력(🎤 버튼)은 자동화 브라우저에 마이크가 없어 직접 테스트 못 함 — 실제 기기에서 확인 필요**. 카카오 도서 검색 API로 줄거리 요약을 가져와 질문 생성 컨텍스트로 사용하도록 이후 추가 완료(`fetchBookContext`, `next-question` 라우트에서 매 턴 호출) — "해리포터와 마법사의 돌"로 실제 브라우저 테스트해 대화 진행/감상문 생성까지 정상 확인
- [x] **3. 독서노트 OCR 입력**: `/read/new`의 OCR 카드 활성화 → `/read/ocr/new`(사진 촬영/선택, 즉시 업로드) → `/read/ocr/[id]/review`(원본 사진 + 책 제목/날짜/내용 필드 — 전부 기본이 "수정 가능"한 입력창, "확인" 버튼 없음) → 저장 → `/home`에 반영. `src/lib/documentIntelligence.ts`(`analyzeImage`, prebuilt-read 모델, analyze→Operation-Location 폴링)로 OCR, `src/lib/azureOpenAI.ts`의 `parseOcrRecord`(gpt-5.4-mini)로 원문을 책 제목/내용으로 구조화(창작 없이 재배열만). OCR/구조화 실패 시에도 에러를 던지지 않고 `ocr_uploads.status='failed'`로 기록하고 빈 칸인 채로 같은 수정 화면을 열어 "직접 입력" 경로를 자연스럽게 제공. 손글씨 대신 인쇄 텍스트로 만든 테스트 이미지("강아지똥" 독서노트)로 Document Intelligence·GPT 구조화를 curl로 먼저 검증한 뒤, 실제 Chrome + 파일 업로드로 사진 선택 → OCR → 리뷰 화면 자동 채움 → 저장까지 전체 플로우 확인, DB에 `reading_records`(source_type=ocr) + `ocr_uploads`(status=processed) 생성됨을 SQL로 검증함. 여러 책이 찍힌 사진 자동 분리는 PRD도 "MVP 이후 검토"라 미구현(한 사진 = 한 기록)
- [x] **4. '독서로' 자동 연동 (수동 등록 가이드 버전)**: 부모의 '독서로' 실제 로그인이 에듀넷 자체 계정임을 확인했으나(SNS 간편 로그인 아님), 이용약관상 자동화(크롤링) 허용 여부가 아직 불명확해서 **Playwright 기반 완전 자동화는 만들지 않기로 사용자가 명시적으로 선택**함("수동 등록 가이드부터(추천)" 옵션 채택). 대신 `/records/[id]`(자녀)·`/settings/records`의 상세 화면(`RecordDetail`)에 "'독서로'에 등록하기" 카드를 추가: (1) 책 제목/날짜/내용을 한 번에 클립보드로 복사하는 버튼, (2) `read365.edunet.net`을 새 탭으로 여는 링크, (3) 사람이 '독서로'에 직접 붙여넣은 뒤 눌러서 상태를 표시하는 "✅ '독서로'에 등록했어요" / "등록 취소로 되돌리기" 토글(`reading_records.dokseoro_status`: pending↔synced, `/api/reading-records/[id]` PATCH에 `dokseoroStatus` 필드 추가). 자녀 본인 기록과 부모가 보는 타 자녀 기록 양쪽에서 실제 브라우저로 복사/외부 링크/상태 토글·되돌리기까지 확인, DB에 `dokseoro_status`가 정확히 반영됨을 SQL로 검증함. 자동 연동(Playwright)은 이용약관 확인 후 필요하면 별도로 재검토
- [x] **5. 기록 관리**: `/records`(자녀 본인 기록 전체 히스토리) · `/records/[id]`(상세, 책 제목/날짜/내용 전부 수정 가능 — RLS가 "본인 것만" vs "가족 전체" 접근을 가른다) · `/settings/records`(부모 대시보드, 두 자녀 기록을 프로필별로 그룹핑해서 한 화면에) · `/home`과 `/records`에서 공용 `RecordCard`(제목/날짜/출처 아이콘/독서로 상태 배지/내용 미리보기)로 통일. `/api/reading-records/[id]` PATCH 하나로 자녀 본인 수정과 부모의 타 자녀 기록 수정을 동시에 지원(권한 분기는 RLS `reading_records_update` 정책이 전담, 라우트 코드는 역할 분기 없음). 실제 브라우저로 자녀 2명 만들고 기록 3건을 시딩해서: 자녀가 본인 기록만 보고 수정 → 로그아웃 → 부모로 로그인 → `/settings/records`에서 두 자녀 기록이 올바르게 그룹핑되어 보이는지 → 다른 자녀(로그인한 부모의 자녀가 아닌 쪽)의 기록을 부모가 직접 수정 → DB에 반영되는지까지 전부 확인함

## Phase 2 범위 (2026-09-10 확정, 우선순위는 진행하며 사용자가 그때그때 지정)

PRD 4.2 "MVP 이후 로드맵" 후보 중 사용자가 명시적으로 아래 4개를 선택함. '독서로' 완전 자동화(Playwright)는 이번에 선택하지 않았으므로 계속 보류(4번 항목 참고, 이용약관 확인 전까지 수동 가이드 유지). Phase 1과 마찬가지로 **한 번에 하나씩, 사용자가 지정하는 순서대로 진행** — 임의로 다음 항목에 손대지 말 것.

- [x] **A. Vercel 배포**: `github.com/teddy706/reading-buddy`를 Vercel(`teddy706's projects` 팀)에 Import → Next.js 프레임워크 자동 인식 → 프로덕션 도메인 발급 완료: **https://reading-buddy-ten.vercel.app**. `main` 브랜치에 push할 때마다 자동 재배포(Vercel의 GitHub 연동 기본 동작, 별도 CI 설정 불필요). 환경변수는 `.env.local`의 15개(ALADIN_API_KEY 제외, 미사용) 전부를 Vercel "Environment Variables"의 "paste the .env contents"로 한 번에 등록(Production and Preview 스코프) — **API 키가 들어가는 입력은 에이전트가 대신 채우지 않고 사용자가 직접 붙여넣음**. 배포 후 프로덕션 URL에서 회원가입 → `/profiles` 진입까지 실제 브라우저로 end-to-end 확인(서버 사이드 Supabase service-role 호출이 Vercel 환경에서도 정상 동작함을 증명), 테스트 계정은 정리 완료. `next.config.mjs`/`middleware.ts`에 localhost 하드코딩이 없어 별도 코드 수정 없이 배포됨. PWA `manifest.json`은 있지만 `icons: []`라 실제 설치 아이콘은 비어있음(후속 개선 여지, 우선순위 아님)
- [x] **B. 독서 통계/리포트**: `/settings/stats`(부모 전용, `/settings`에서 진입). 자녀별 전체 누적 권수·이번 달 권수, 최근 6개월 독서량 추이(자녀별 막대그래프, `src/lib/readingStats.ts`의 `lastNMonths`/`countByMonth`), 기록 방식(대화/독서노트/직접입력) 비율, '독서로' 반영 현황(반영 완료 vs 미반영)을 보여줌. **장르 분포는 스키마에 장르 컬럼이 없어서 구현하지 않음**(추가하려면 카카오 도서 API 응답을 저장하는 새 컬럼과 마이그레이션이 필요 — 지금은 범위 밖으로 판단). 차트 라이브러리 없이 순수 CSS(`div` 높이/너비 비율)로 구현해 번들 크기 영향 없음. 두 자녀 6개월치 19건 기록을 시딩해서 합계/월별 추이/기록방식 비율/독서로 현황 숫자가 실제 DB 값과 정확히 일치하는지 데스크톱·모바일 뷰포트 둘 다 실제 브라우저로 검증함
- [ ] **C. 표지 촬영 자동 인식**: `/read/new/book`에서 책 제목을 직접 입력하는 대신 표지 사진으로 책 정보 자동 매칭. 접근 방식(ISBN 바코드 스캔 vs 표지 이미지 OCR로 제목 인식 후 카카오 도서 검색 API 매칭 등) 설계 필요 — 착수 전에 먼저 방식을 정할 것
- [ ] **D. 형제자매 비교/배지·스탬프**: 쌍둥이 간 선의의 경쟁 요소. 배지 규칙(무엇을 달성하면 어떤 배지인지), 새 테이블(예: `badges`/`badge_awards`) 설계 필요 — 4개 중 설계 범위가 가장 넓음

## Supabase 셋업 중 발견한 함정 (재발 방지용 기록)

- **service_role 키는 반드시 legacy JWT 형식**: API Keys 화면의 새 형식 secret key(`sb_secret_...`)로 `SUPABASE_SERVICE_ROLE_KEY`를 채우면 `auth.admin.createUser()`는 되는데 `admin.from(table).insert(...)` 같은 PostgREST 호출이 전부 `permission denied`로 막힌다(GoTrue admin API와 PostgREST의 role 판별 방식이 다름). "Legacy anon, service_role API keys" 탭의 JWT를 써야 한다
- **"Automatically expose new tables"를 끄면 service_role도 GRANT가 없다**: 프로젝트 생성 시 이 옵션을 끄면 anon/authenticated 노출만 막히는 게 아니라, 새로 만드는 모든 테이블에 대해 service_role 포함 아무 role도 기본 GRANT를 못 받는다(RLS와는 별개 계층). `0006_grants.sql`이 이걸 명시적으로 고쳐준다 — 이 프로젝트에서 앞으로도 저 옵션은 끈 채로 가져가되, 새 테이블을 추가하는 마이그레이션마다 `0006_grants.sql`의 `alter default privileges`가 이미 커버하는지 재확인할 것
- Supabase 대시보드 SQL Editor를 브라우저 자동화로 조작할 때는 `cmd+Return`/`cmd+A`가 안 먹을 수 있다는 이슈도 있었음(별도 메모리에 기록) — Run 버튼을 직접 클릭하고 실행 후 실제 값을 다시 조회해서 검증할 것
- **`storage.objects`는 일반 SQL `delete`로 못 지운다**(`storage.protect_delete()` 트리거가 막음, "Use the Storage API instead"). 테스트 데이터 정리 시 `families`/`auth.users`와 한 쿼리에 같이 넣으면 그 문장에서 전체 트랜잭션이 롤백된다 — Storage REST API(`DELETE {url}/storage/v1/object/{bucket}/{path}`, service_role 키)로 먼저 지우고, DB row 삭제는 별도 쿼리로 실행할 것

## Azure 셋업 중 발견한 함정 (재발 방지용 기록)

- **모델 배포는 Foundry 포털(ai.azure.com)에서만 가능**: 클래식 Azure Portal의 Azure OpenAI 리소스 블레이드에는 "모델 배포" 메뉴가 없다 — 리소스 개요의 "Foundry 포털로 이동" 링크로 넘어가야 한다
- **Foundry 포털의 "배포" 버튼이 가끔 조용히 실패한다**: 브라우저 콘솔에 IndexedDB `NotFoundError`가 찍히면서 배포 목록에 아무것도 안 뜨는 현상을 겪었다(자동화 브라우저·일반 브라우저 둘 다). 배포 후 반드시 목록을 새로고침해서 상태가 "성공(Succeeded)"으로 뜨는지, 또는 `curl {endpoint}openai/deployments?api-version=2023-03-15-preview -H "api-key: ..."` 로 실제 존재 여부를 확인할 것 — 안 뜨면 시크릿 창 등 깨끗한 세션에서 재시도
- **gpt-4o-mini는 단종됨**(2026-09-10 기준). "저지연 경량 모델" 자리는 후속 모델(현재 `gpt-5.4-mini`)로 계속 교체될 수 있다
- **신형 모델은 `max_tokens` 대신 `max_completion_tokens`를 요구한다**: `gpt-5.4-mini`에 `max_tokens`를 보내면 400 `unsupported_parameter` 에러가 난다. `gpt-4o`는 두 파라미터 다 허용하므로, 두 배포 모두 `max_completion_tokens`로 통일해서 호출할 것 (Phase 1 "2. 대화 기반 독서 기록" 구현 시 `src/lib/azureOpenAI.ts`에 반영)
- Azure OpenAI의 TPM 할당량은 **리소스가 아니라 "구독+리전+모델" 단위로 공유**된다 — 같은 구독의 다른 리소스(`twin_choice`의 `twin`)가 같은 리전에서 이미 어떤 모델의 할당량을 쓰고 있으면, 새 리소스에서 그 모델을 기본 용량(예: 250K TPM)으로 배포하려 할 때 실패할 수 있다. 배포 전 Foundry 포털의 "할당량" 페이지에서 남은 양을 확인하거나, 배포 시 "사용자 지정"으로 용량을 낮출 것

## 참고 문서

- [docs/PRD.md](docs/PRD.md) — 전체 PRD (v1.5)
- `twin_choice/CLAUDE.md` — 자매 앱의 인증/RLS 패턴 원본 (같은 머신의 형제 저장소)
