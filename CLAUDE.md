# CLAUDE.md — 리딩버디 (독서 기록 앱)

이 파일은 프로젝트 루트에 두고 Claude Code가 매 세션 시작 시 참고하는 컨텍스트 문서입니다. **Phase 1의 "1. 계정/인증"까지 구현·실제 브라우저 테스트 완료. 지금은 "2. 대화 기반 독서 기록"부터 순서대로 진행 중입니다.**

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
| 책 정보 조회 | 알라딘/카카오 도서 API로 줄거리 요약만 가져와 프롬프트 컨텍스트로 사용. **AI 내장 웹검색 도구는 호출당 토큰 비용이 커서 사용하지 않음** (PRD 6.4) |
| 비용 정책 | Supabase는 무료 티어 유지, Azure AI는 월 $150 예산 내에서 Standard(S0) 등 유료 티어를 품질 우선으로 사용 (PRD 6.5) |
| 확장성 원칙 | 전 테이블 `family_id` 기반. 코드에 "가족은 하나뿐"이라는 가정(하드코딩된 family_id, 환경변수 등)을 절대 심지 않을 것 |
| PIN 잠금 정책 | 5회 연속 실패 시 1분 잠금(`profiles.pin_fail_count`/`pin_locked_until`, `src/lib/childAuth.ts`의 `PIN_MAX_ATTEMPTS`/`PIN_LOCK_DURATION_MS`). PRD 3.1 확정 사항 — twin_choice에는 없는 재량 추가 |
| 프로필 전환 후 "나가기" | PIN 성공 시 부모 세션이 자녀 synthetic 세션으로 완전히 교체된다(9.1 구현 노트). 자녀 홈의 "나가기"는 세션을 완전히 로그아웃시키고 `/login`으로 보낸다 — 부모는 이메일/비밀번호를 다시 입력해야 부모 모드로 돌아온다. 매번 재로그인해야 하는 게 불편하면 "부모 비밀번호만 다시 묻는 가벼운 게이트"로 바꾸는 걸 고려할 수 있으나, 현재는 완전 재로그인이 가장 단순하고 안전한 기본값으로 채택됨 |

## 확정 안 된(추가 확인 필요) 사항

- **'독서로' 실제 로그인 방식**: 에듀넷 자체 계정인지 SNS(네이버/구글/카카오) 간편 로그인인지 아직 미확인. `dokseoro_credentials` 스키마는 `login_type` 컬럼으로 양쪽을 구분해뒀지만, SNS 계정인 경우 자동화 난이도가 크게 올라간다(PRD 9.7). **독서로 자동화 기능에 손대기 전에 반드시 먼저 확인할 것.**
- '독서로' 이용약관상 자동화(크롤링) 허용 여부 — 공공 교육 플랫폼이라 금지 가능성 있음. 확인 전까지는 "자동 등록 실패 시 수동 등록 가이드"를 필수 폴백으로 설계.

## 현재 상태: 개발 사전 셋업 완료 (Phase 0)

- [x] Next.js 14 + TS + Tailwind + App Router 스캐폴딩
- [x] Supabase client/server/admin 클라이언트 (`src/lib/supabase/`)
- [x] 자녀 PIN → synthetic 계정 인증 헬퍼 (`src/lib/childAuth.ts`)
- [x] DB 스키마/RLS/스토리지 마이그레이션 (`supabase/migrations/0001~0004`)
- [x] `.env.local.example`, README, PRD 문서화
- [x] GitHub private 저장소 생성
- [x] **Supabase 프로젝트 실제 생성 및 마이그레이션 적용 완료** — `teddy706's Org` 조직, 프로젝트명 `reading-buddy`, 리전 ap-northeast-2(Seoul), URL `https://ebtlnygmfmglwxpcqczz.supabase.co`. `.env.local`에 실제 키 반영 완료(gitignored). 테이블 6개 + RLS 정책(families 1/profiles 1/conversation_sessions 3/ocr_uploads 3/reading_records 3) + storage 정책 2개 + `reading-notes` 버킷까지 SQL Editor에서 직접 실행/검증함. `dokseoro_credentials`는 의도대로 정책 0개(완전 차단)
- [x] **Azure 리소스 실제 생성 및 연결 확인 완료** — 전부 리소스 그룹 `RG-reading-buddy`(Korea Central) 아래: `reading-buddy-openai`(Azure OpenAI, 배포 `gpt-4o`/`gpt-5.4-mini` 둘 다 `curl`로 실제 채팅 호출 성공 확인), `reading-buddy-speech`(Azure AI Speech, 토큰 발급 확인), `reading-buddy-docintel`(Document Intelligence, `/documentintelligence/info` 확인). `.env.local`에 전부 반영 완료. 알라딘/카카오 도서 API 키만 아직 미설정
- [ ] 알라딘/카카오 도서 API 키는 아직 미설정 (`.env.local`에 플레이스홀더로 남아있음) — Phase 1 "2. 대화 기반 독서 기록" 착수 시 채울 것

## Phase 1 진행 순서 (PRD 5.2 기준)

번호 순서대로 하나씩 진행할 것. 앞 번호가 안 끝났으면 뒷 번호에 먼저 손대지 말 것.

- [x] **1. 계정/인증**: 부모 회원가입/로그인(`/signup`, `/login`), 자녀 프로필 생성 UI(`/profiles/new`), 프로필 선택(`/profiles`) → PIN 입력(`/profiles/[id]/pin`) → 세션 전환 → 자녀 홈(`/home`) 흐름 구현 및 실제 브라우저로 전체 플로우(가입→프로필 생성→PIN 성공/실패/5회 잠금→나가기→재로그인→PIN 재설정)까지 테스트 완료. 부모 설정(`/settings/children`)에서 이름/아바타 수정 + PIN 재설정 가능
- [ ] **2. 대화 기반 독서 기록**: 책 정보 입력 → 도서 API 조회 → 동적 질문 생성(음성 입력 포함) → 감상문 생성 → 확인/편집 → 저장 (와이어프레임: docs/PRD.md 9.5). 폴백 질문 3개(책 제목 확인/재미있었던 부분/느낀 점) 반드시 포함
- [ ] **3. 독서노트 OCR 입력**: 사진 촬영 → Document Intelligence OCR → 결과 확인/수정 UI (와이어프레임: docs/PRD.md 9.6). "확인"이 아니라 "수정"이 기본 동작이어야 함
- [ ] **4. '독서로' 자동 연동**: 로그인 방식 확인 후 착수. Playwright 기반 자동화 + 실패 시 수동 등록 가이드 폴백 필수
- [ ] **5. 기록 관리**: 자녀별 기록 리스트/히스토리, 부모 대시보드(두 자녀 기록 현황 + 프로필/PIN 관리) — `/home`은 현재 빈 목록 placeholder만 있음

## Supabase 셋업 중 발견한 함정 (재발 방지용 기록)

- **service_role 키는 반드시 legacy JWT 형식**: API Keys 화면의 새 형식 secret key(`sb_secret_...`)로 `SUPABASE_SERVICE_ROLE_KEY`를 채우면 `auth.admin.createUser()`는 되는데 `admin.from(table).insert(...)` 같은 PostgREST 호출이 전부 `permission denied`로 막힌다(GoTrue admin API와 PostgREST의 role 판별 방식이 다름). "Legacy anon, service_role API keys" 탭의 JWT를 써야 한다
- **"Automatically expose new tables"를 끄면 service_role도 GRANT가 없다**: 프로젝트 생성 시 이 옵션을 끄면 anon/authenticated 노출만 막히는 게 아니라, 새로 만드는 모든 테이블에 대해 service_role 포함 아무 role도 기본 GRANT를 못 받는다(RLS와는 별개 계층). `0006_grants.sql`이 이걸 명시적으로 고쳐준다 — 이 프로젝트에서 앞으로도 저 옵션은 끈 채로 가져가되, 새 테이블을 추가하는 마이그레이션마다 `0006_grants.sql`의 `alter default privileges`가 이미 커버하는지 재확인할 것
- Supabase 대시보드 SQL Editor를 브라우저 자동화로 조작할 때는 `cmd+Return`/`cmd+A`가 안 먹을 수 있다는 이슈도 있었음(별도 메모리에 기록) — Run 버튼을 직접 클릭하고 실행 후 실제 값을 다시 조회해서 검증할 것

## Azure 셋업 중 발견한 함정 (재발 방지용 기록)

- **모델 배포는 Foundry 포털(ai.azure.com)에서만 가능**: 클래식 Azure Portal의 Azure OpenAI 리소스 블레이드에는 "모델 배포" 메뉴가 없다 — 리소스 개요의 "Foundry 포털로 이동" 링크로 넘어가야 한다
- **Foundry 포털의 "배포" 버튼이 가끔 조용히 실패한다**: 브라우저 콘솔에 IndexedDB `NotFoundError`가 찍히면서 배포 목록에 아무것도 안 뜨는 현상을 겪었다(자동화 브라우저·일반 브라우저 둘 다). 배포 후 반드시 목록을 새로고침해서 상태가 "성공(Succeeded)"으로 뜨는지, 또는 `curl {endpoint}openai/deployments?api-version=2023-03-15-preview -H "api-key: ..."` 로 실제 존재 여부를 확인할 것 — 안 뜨면 시크릿 창 등 깨끗한 세션에서 재시도
- **gpt-4o-mini는 단종됨**(2026-09-10 기준). "저지연 경량 모델" 자리는 후속 모델(현재 `gpt-5.4-mini`)로 계속 교체될 수 있다
- **신형 모델은 `max_tokens` 대신 `max_completion_tokens`를 요구한다**: `gpt-5.4-mini`에 `max_tokens`를 보내면 400 `unsupported_parameter` 에러가 난다. `gpt-4o`는 두 파라미터 다 허용하므로, 두 배포 모두 `max_completion_tokens`로 통일해서 호출할 것 (Phase 1 "2. 대화 기반 독서 기록" 구현 시 `src/lib/azureOpenAI.ts`에 반영)
- Azure OpenAI의 TPM 할당량은 **리소스가 아니라 "구독+리전+모델" 단위로 공유**된다 — 같은 구독의 다른 리소스(`twin_choice`의 `twin`)가 같은 리전에서 이미 어떤 모델의 할당량을 쓰고 있으면, 새 리소스에서 그 모델을 기본 용량(예: 250K TPM)으로 배포하려 할 때 실패할 수 있다. 배포 전 Foundry 포털의 "할당량" 페이지에서 남은 양을 확인하거나, 배포 시 "사용자 지정"으로 용량을 낮출 것

## 참고 문서

- [docs/PRD.md](docs/PRD.md) — 전체 PRD (v1.5)
- `twin_choice/CLAUDE.md` — 자매 앱의 인증/RLS 패턴 원본 (같은 머신의 형제 저장소)
