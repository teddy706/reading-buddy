# CLAUDE.md — 리딩버디 (독서 기록 앱)

이 파일은 프로젝트 루트에 두고 Claude Code가 매 세션 시작 시 참고하는 컨텍스트 문서입니다. **현재는 개발 사전 셋업(스캐폴딩)만 완료된 상태이고, Phase 1 기능 구현은 아직 시작 전입니다.**

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
| AI — 질문 생성 | Azure OpenAI 저지연 경량 모델(gpt-4o-mini급, `AZURE_OPENAI_QUESTION_DEPLOYMENT`) — 대화 흐름이 끊기지 않도록 응답 속도 우선 |
| AI — 감상문 생성 | Azure OpenAI 상위 품질 모델(gpt-4o 이상, `AZURE_OPENAI_ESSAY_DEPLOYMENT`) — 세션당 1회 호출이라 속도보다 문장 품질 우선 |
| AI 생성 감상문 윤리 | 아이가 답변하지 않은 내용을 임의로 창작하지 않는다. 감상문은 아이 답변의 재구성이며, 원본 대화 로그(`conversation_sessions.messages`)를 항상 함께 보관해 부모가 대조 확인 가능하게 함 |
| 책 정보 조회 | 알라딘/카카오 도서 API로 줄거리 요약만 가져와 프롬프트 컨텍스트로 사용. **AI 내장 웹검색 도구는 호출당 토큰 비용이 커서 사용하지 않음** (PRD 6.4) |
| 비용 정책 | Supabase는 무료 티어 유지, Azure AI는 월 $150 예산 내에서 Standard(S0) 등 유료 티어를 품질 우선으로 사용 (PRD 6.5) |
| 확장성 원칙 | 전 테이블 `family_id` 기반. 코드에 "가족은 하나뿐"이라는 가정(하드코딩된 family_id, 환경변수 등)을 절대 심지 않을 것 |

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
- [ ] Azure OpenAI / Speech / Document Intelligence / 알라딘·카카오 도서 API 키는 아직 미설정 (`.env.local`에 플레이스홀더로 남아있음) — Phase 1 해당 기능 착수 시 채울 것

## Phase 1 진행 순서 (PRD 5.2 기준, 아직 시작 전)

번호 순서대로 하나씩 진행할 것. 앞 번호가 안 끝났으면 뒷 번호에 먼저 손대지 말 것.

- [ ] **1. 계정/인증**: 부모 회원가입/로그인, 자녀 프로필 2개 생성 UI, 프로필 선택 → PIN 입력 → 전환 흐름 (와이어프레임: docs/PRD.md 9.4)
- [ ] **2. 대화 기반 독서 기록**: 책 정보 입력 → 도서 API 조회 → 동적 질문 생성(음성 입력 포함) → 감상문 생성 → 확인/편집 → 저장 (와이어프레임: docs/PRD.md 9.5). 폴백 질문 3개(책 제목 확인/재미있었던 부분/느낀 점) 반드시 포함
- [ ] **3. 독서노트 OCR 입력**: 사진 촬영 → Document Intelligence OCR → 결과 확인/수정 UI (와이어프레임: docs/PRD.md 9.6). "확인"이 아니라 "수정"이 기본 동작이어야 함
- [ ] **4. '독서로' 자동 연동**: 로그인 방식 확인 후 착수. Playwright 기반 자동화 + 실패 시 수동 등록 가이드 폴백 필수
- [ ] **5. 기록 관리**: 자녀별 기록 리스트/히스토리, 부모 대시보드(두 자녀 기록 현황 + 프로필/PIN 관리)

## 참고 문서

- [docs/PRD.md](docs/PRD.md) — 전체 PRD (v1.5)
- `twin_choice/CLAUDE.md` — 자매 앱의 인증/RLS 패턴 원본 (같은 머신의 형제 저장소)
