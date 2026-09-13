# CLAUDE.md — 리딩버디 (Reading Buddy, 독서 기록 앱)

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
  - **(2026-09-12 추가) `dokseoro_credentials` 테이블 제거**: Phase 1 "4. '독서로' 자동 연동"이 자동 로그인 자격증명을 저장하지 않는 "수동 등록 가이드" 버전으로 확정된 뒤, 이 테이블이 `src/` 어디에서도 참조되지 않는 죽은 스키마로 남아 있던 것을 코드 리뷰 중 발견 — `0008_drop_dokseoro_credentials.sql`로 제거함(트리거·RLS 정책은 테이블과 함께 자동으로 사라짐). `.env.local.example`의 `DOKSEORO_CREDENTIALS_ENCRYPTION_KEY`, README 3-4번 항목, `docs/PRD.md` 9.2/9.3/9.7의 관련 서술도 함께 정리함(PRD는 삭제 대신 취소선 + 구현 노트로 이력을 남김). **사용자가 실제 Supabase 프로젝트의 SQL Editor에서 `0008_drop_dokseoro_credentials.sql`을 아직 실행하지 않았다면, 다른 마이그레이션과 마찬가지로 번호 순서에 맞춰 직접 실행해야 실제 DB에도 반영된다** — 이 코드베이스의 마이그레이션은 `supabase db push`가 아니라 지금까지 전부 SQL Editor 수동 실행으로 적용해왔음. 이제 테이블은 5개(families/profiles/conversation_sessions/ocr_uploads/reading_records)
- [x] **Azure 리소스 실제 생성 및 연결 확인 완료** — 전부 리소스 그룹 `RG-reading-buddy`(Korea Central) 아래: `reading-buddy-openai`(Azure OpenAI, 배포 `gpt-4o`/`gpt-5.4-mini` 둘 다 `curl`로 실제 채팅 호출 성공 확인), `reading-buddy-speech`(Azure AI Speech, 토큰 발급 확인), `reading-buddy-docintel`(Document Intelligence, `/documentintelligence/info` 확인). `.env.local`에 전부 반영 완료
- [x] **카카오 도서 검색 API 연동 완료** — Kakao Developers 앱 "리딩버디"(ID 1573541) 생성, REST API 키를 `.env.local`의 `KAKAO_REST_API_KEY`에 반영, `src/lib/kakaoBook.ts`로 대화 질문 생성에 연결(아래 Phase 1 2번 참고). 알라딘은 미연동

## Phase 1 진행 순서 (PRD 5.2 기준)

번호 순서대로 하나씩 진행할 것. 앞 번호가 안 끝났으면 뒷 번호에 먼저 손대지 말 것.

- [x] **1. 계정/인증**: 부모 회원가입/로그인(`/signup`, `/login`), 자녀 프로필 생성 UI(`/profiles/new`), 프로필 선택(`/profiles`) → PIN 입력(`/profiles/[id]/pin`) → 세션 전환 → 자녀 홈(`/home`) 흐름 구현 및 실제 브라우저로 전체 플로우(가입→프로필 생성→PIN 성공/실패/5회 잠금→나가기→재로그인→PIN 재설정)까지 테스트 완료. 부모 설정(`/settings/children`)에서 이름/아바타 수정 + PIN 재설정 가능
  - **아바타 사진 업로드 (2026-09-11 추가)**: 이모지 아바타 대신(또는 대체) 자녀 얼굴 사진을 올릴 수 있음. `profiles.avatar_photo_path`(nullable, `0007_avatar_photo.sql`)가 있으면 이모지 대신 사진을 보여준다. 비공개 `avatars` 스토리지 버킷(자녀 얼굴 사진이라 `reading-notes`와 동일 수준으로 비공개 유지) + storage RLS(같은 가족이면 조회 가능 — 기존 이모지 아바타의 공개 범위와 동일, 업로드/교체/삭제는 부모만). 경로는 `{family_id}/{profile_id}`(확장자 없음, 항상 upsert)라 재업로드해도 이전 파일이 안 남고, 제거 시(`/api/children/[id]` PATCH에 `avatarPhotoPath: null`) 서버가 실제 스토리지 파일도 같이 지운다. 화면에 보여줄 때마다 서명된 URL을 새로 발급(`src/lib/avatarPhoto.ts`, TTL 7일 — 페이지 렌더마다 재발급되니 문제없음)하는 방식이라 이 URL을 표시하는 8곳(프로필 선택/PIN/홈/기록 상세/설정의 통계·배지·기록·자녀 관리)을 전부 서버 컴포넌트에서 signed URL을 만들어 내려주도록 수정함. 업로드는 클라이언트가 Supabase Storage에 직접 하고(브라우저 인증 세션 기준 RLS로 가족+부모 역할만 허용), API 라우트는 경로 문자열만 받아 `profiles`에 기록. 부모 계정으로 사진 올리기 → 프로필 선택/PIN/자녀 홈에 반영 확인 → 로그아웃 후 재로그인해도 유지 확인 → 사진 제거(이모지 복귀 + 스토리지 파일 실제 삭제 확인) → 다른 형식(JPEG→PNG) 재업로드(upsert 덮어쓰기) 확인까지 실제 브라우저(claude-in-chrome, 파일 업로드 필요)로 end-to-end 검증함
  - **자녀 등록 시 사진 업로드 + 프로필 삭제 + PIN 확인 버튼 (2026-09-11 추가)**: 사용자 피드백 3건 반영.
    1. 자녀 **등록**(`/profiles/new`) 화면에도 사진 업로드를 추가 — 기존엔 등록 후 수정 화면에서만 가능했다. 프로필이 아직 없는 시점이라 파일은 `URL.createObjectURL`로 미리보기만 해두고(즉시 피드백), PIN 확인까지 끝나 `/api/children` POST로 실제 `profile.id`/`family_id`를 받은 뒤에야 Storage에 업로드 + PATCH로 기록한다(POST 응답에 `family_id` 추가). 사진 업로드가 실패해도 프로필 생성 자체는 막지 않고 조용히 넘어감(나중에 자녀 관리에서 다시 올릴 수 있음).
    2. 자녀 **삭제** 기능이 아예 없었다 — `/api/children/[id]` DELETE 라우트 추가, `ChildEditCard`에 "자녀 프로필 삭제"(빨간색, 되돌릴 수 없다는 경고 + 취소/확인 2단계) 버튼 추가. 자녀의 synthetic auth 계정을 지우면 `profiles.user_id`의 `on delete cascade`로 프로필 row와 그 아래 `reading_records`/`conversation_sessions`/`ocr_uploads`까지 전부 함께 지워진다(0001_schema.sql) — 아바타 스토리지 파일은 별도로 먼저 지움.
    3. **PIN 화면이 4자리 입력 즉시 서버에 제출**돼서, 응답이 오기 전까지 화면이 멈춘 것처럼 보여 "눌렀는데 되는 건지 모르겠다"는 피드백을 받음. 로그인 PIN(`PinEntry`)·자녀 등록 PIN 설정(`/profiles/new`)·PIN 재설정(`ChildEditCard`) 세 화면 전부, 4자리 입력 후 자동 제출하지 않고 새로 만든 공용 `PinConfirmButton`(`src/components/PinKeypad.tsx`)을 눌러야 넘어가도록 바꿈 — 로딩 중엔 버튼 라벨이 "확인하는 중..."/"만드는 중..."으로 바뀌어 진행 상태가 보인다. 검토 중 `ChildEditCard`의 PIN 재설정 네트워크 호출에 로딩 상태 자체가 없던 것과, 아바타 사진 최초 업로드 시(기존 사진이 없을 때) 로딩 텍스트가 전혀 안 보이던 것도 같은 문제로 보고 함께 고침. 실제 브라우저로 세 PIN 화면 전부(4자리 입력 후 자동 전환 안 됨 → 버튼으로 진행 확인, 로그인 PIN 오답/정답 처리) + 등록 시 사진 업로드(미리보기 즉시 표시 → 프로필 선택 화면에 반영 확인) + 삭제(DB profiles/families, Storage avatars, auth.users 전부 삭제됨을 REST API로 검증) 확인함
- [x] **2. 대화 기반 독서 기록**: `/read/new`(기록 방식 선택, OCR 카드는 비활성) → `/read/new/book`(책 제목/저자 입력) → `/read/[id]/chat`(대화 진행, 텍스트+음성 입력, N/4 진행 표시, "그만할래") → `/read/[id]/review`(감상문 생성/편집, 원본 대화 펼쳐보기, 저장) → `/home`에 반영. `src/lib/azureOpenAI.ts`(`generateNextQuestion`/`generateEssay`, gpt-5.4-mini/gpt-4o, `max_completion_tokens` 사용)와 `src/lib/azureSpeech.ts`(음성 답변 STT, REST 단문 인식 엔드포인트)로 구현. 실제 브라우저로 텍스트 답변 4턴 → 감상문 생성 → 저장까지 end-to-end 확인, DB에 `reading_records`(dokseoro_status=pending) + `conversation_sessions`(status=completed) 생성됨을 SQL로 검증함. **음성 입력(🎤 버튼)은 자동화 브라우저에 마이크가 없어 직접 테스트 못 함 — 실제 기기에서 확인 필요**. 카카오 도서 검색 API로 줄거리 요약을 가져와 질문 생성 컨텍스트로 사용하도록 이후 추가 완료(`fetchBookContext`, `next-question` 라우트에서 매 턴 호출) — "해리포터와 마법사의 돌"로 실제 브라우저 테스트해 대화 진행/감상문 생성까지 정상 확인
  - **단계별 독서록 유도 질문 프레임워크 (2026-09-10 사용자 설계 기반 도입)**: 범용 "이전 답변 이어서 질문" 방식 대신, 4개 질문을 1단계 "장면 소환"(2문항 — 사건→행동, 줄거리/실제로 읽었는지 확인) → 2단계 "역할 바꾸기"(공감·"나라면") → 3단계 "현실 적용"(자기 생활과 연결)으로 고정 매핑(`src/lib/readingSession.ts`의 `STAGE_PLAN`/`stageForQuestionIndex`). `generateNextQuestion`이 `questionIndex` 대신 `stage`로 시스템 프롬프트를 분기하고(`STAGE_INSTRUCTIONS`), 두 번째 질문부터는 아이 답변에 짧게 공감/칭찬한 뒤 다음 질문으로 넘어가도록 지침을 추가함. `ConversationMessage`에 `stage` 필드를 추가(jsonb라 마이그레이션 불필요)해서 assistant(질문) 메시지마다 몇 단계 질문인지 저장. `generateEssay`는 `groupAnswersByStage`로 답변을 단계별로 묶어 **처음(1단계 답변=줄거리)-가운데(2단계 답변="나라면"식 생각)-끝(3단계 답변=현실 연결)** 정확히 3개 문단으로 조립하는 "독서록 조립 공식"을 프롬프트에 명시 — 단, 사용자가 제시한 문장 틀("만약 나라면 그렇게 행동하지 않고 ~했을 것이다")을 매번 그대로 쓰지 않고 아이의 실제 답변에 맞게 자연스럽게 재구성하도록 함(반복적인 정형 문장이 되는 것을 피하기 위한 의도적 선택). 옛 세션(이 기능 이전 생성, `stage` 필드 없음)도 등장 순서로 단계를 추정해 감상문 생성이 깨지지 않게 폴백 처리함. 채팅 화면 진행 표시도 "N/4 질문"에서 "장면 소환 · N/4 질문"처럼 단계 라벨을 함께 보여주도록 개선. 실제 브라우저로 "무지개 물고기" 4턴 전체 흐름(장면 소환→역할 바꾸기→현실 적용 단계 전환, 매 턴 공감 문구)과 최종 3단 구성 감상문 생성을 확인, DB에 `conversation_sessions.messages`의 각 질문에 `stage`(1/1/2/3)가 정확히 저장됨을 SQL로 검증함
- [x] **3. 독서노트 OCR 입력**: `/read/new`의 OCR 카드 활성화 → `/read/ocr/new`(사진 촬영/선택, 즉시 업로드) → `/read/ocr/[id]/review`(원본 사진 + 책 제목/날짜/내용 필드 — 전부 기본이 "수정 가능"한 입력창, "확인" 버튼 없음) → 저장 → `/home`에 반영. `src/lib/documentIntelligence.ts`(`analyzeImage`, prebuilt-read 모델, analyze→Operation-Location 폴링)로 OCR, `src/lib/azureOpenAI.ts`의 `parseOcrRecord`(gpt-5.4-mini)로 원문을 책 제목/내용으로 구조화(창작 없이 재배열만). OCR/구조화 실패 시에도 에러를 던지지 않고 `ocr_uploads.status='failed'`로 기록하고 빈 칸인 채로 같은 수정 화면을 열어 "직접 입력" 경로를 자연스럽게 제공. 손글씨 대신 인쇄 텍스트로 만든 테스트 이미지("강아지똥" 독서노트)로 Document Intelligence·GPT 구조화를 curl로 먼저 검증한 뒤, 실제 Chrome + 파일 업로드로 사진 선택 → OCR → 리뷰 화면 자동 채움 → 저장까지 전체 플로우 확인, DB에 `reading_records`(source_type=ocr) + `ocr_uploads`(status=processed) 생성됨을 SQL로 검증함. 여러 책이 찍힌 사진 자동 분리는 PRD도 "MVP 이후 검토"라 미구현(한 사진 = 한 기록)
- [x] **4. '독서로' 자동 연동 (수동 등록 가이드 버전)**: 부모의 '독서로' 실제 로그인이 에듀넷 자체 계정임을 확인했으나(SNS 간편 로그인 아님), 이용약관상 자동화(크롤링) 허용 여부가 아직 불명확해서 **Playwright 기반 완전 자동화는 만들지 않기로 사용자가 명시적으로 선택**함("수동 등록 가이드부터(추천)" 옵션 채택). 대신 `/records/[id]`(자녀)·`/settings/records`의 상세 화면(`RecordDetail`)에 "'독서로'에 등록하기" 카드를 추가: (1) 책 제목/날짜/내용을 한 번에 클립보드로 복사하는 버튼, (2) `read365.edunet.net`을 새 탭으로 여는 링크, (3) 사람이 '독서로'에 직접 붙여넣은 뒤 눌러서 상태를 표시하는 "✅ '독서로'에 등록했어요" / "등록 취소로 되돌리기" 토글(`reading_records.dokseoro_status`: pending↔synced, `/api/reading-records/[id]` PATCH에 `dokseoroStatus` 필드 추가). 자녀 본인 기록과 부모가 보는 타 자녀 기록 양쪽에서 실제 브라우저로 복사/외부 링크/상태 토글·되돌리기까지 확인, DB에 `dokseoro_status`가 정확히 반영됨을 SQL로 검증함. 자동 연동(Playwright)은 이용약관 확인 후 필요하면 별도로 재검토
- [x] **5. 기록 관리**: `/records`(자녀 본인 기록 전체 히스토리) · `/records/[id]`(상세, 책 제목/날짜/내용 전부 수정 가능 — RLS가 "본인 것만" vs "가족 전체" 접근을 가른다) · `/settings/records`(부모 대시보드, 두 자녀 기록을 프로필별로 그룹핑해서 한 화면에) · `/home`과 `/records`에서 공용 `RecordCard`(제목/날짜/출처 아이콘/독서로 상태 배지/내용 미리보기)로 통일. `/api/reading-records/[id]` PATCH 하나로 자녀 본인 수정과 부모의 타 자녀 기록 수정을 동시에 지원(권한 분기는 RLS `reading_records_update` 정책이 전담, 라우트 코드는 역할 분기 없음). 실제 브라우저로 자녀 2명 만들고 기록 3건을 시딩해서: 자녀가 본인 기록만 보고 수정 → 로그아웃 → 부모로 로그인 → `/settings/records`에서 두 자녀 기록이 올바르게 그룹핑되어 보이는지 → 다른 자녀(로그인한 부모의 자녀가 아닌 쪽)의 기록을 부모가 직접 수정 → DB에 반영되는지까지 전부 확인함

## Phase 2 범위 (2026-09-10 확정, 우선순위는 진행하며 사용자가 그때그때 지정)

PRD 4.2 "MVP 이후 로드맵" 후보 중 사용자가 명시적으로 아래 4개를 선택함. '독서로' 완전 자동화(Playwright)는 이번에 선택하지 않았으므로 계속 보류(4번 항목 참고, 이용약관 확인 전까지 수동 가이드 유지). Phase 1과 마찬가지로 **한 번에 하나씩, 사용자가 지정하는 순서대로 진행** — 임의로 다음 항목에 손대지 말 것.

- [x] **A. Vercel 배포**: `github.com/teddy706/reading-buddy`를 Vercel(`teddy706's projects` 팀)에 Import → Next.js 프레임워크 자동 인식 → 프로덕션 도메인 발급 완료: **https://reading-buddy-ten.vercel.app**. `main` 브랜치에 push할 때마다 자동 재배포(Vercel의 GitHub 연동 기본 동작, 별도 CI 설정 불필요). 환경변수는 `.env.local`의 15개(ALADIN_API_KEY 제외, 미사용) 전부를 Vercel "Environment Variables"의 "paste the .env contents"로 한 번에 등록(Production and Preview 스코프) — **API 키가 들어가는 입력은 에이전트가 대신 채우지 않고 사용자가 직접 붙여넣음**. 배포 후 프로덕션 URL에서 회원가입 → `/profiles` 진입까지 실제 브라우저로 end-to-end 확인(서버 사이드 Supabase service-role 호출이 Vercel 환경에서도 정상 동작함을 증명), 테스트 계정은 정리 완료. `next.config.mjs`/`middleware.ts`에 localhost 하드코딩이 없어 별도 코드 수정 없이 배포됨. PWA `manifest.json`은 있지만 `icons: []`라 실제 설치 아이콘은 비어있음(후속 개선 여지, 우선순위 아님)
- [x] **B. 독서 통계/리포트**: `/settings/stats`(부모 전용, `/settings`에서 진입). 자녀별 전체 누적 권수·이번 달 권수, 최근 6개월 독서량 추이(자녀별 막대그래프, `src/lib/readingStats.ts`의 `lastNMonths`/`countByMonth`), 기록 방식(대화/독서노트/직접입력) 비율, '독서로' 반영 현황(반영 완료 vs 미반영)을 보여줌. **장르 분포는 스키마에 장르 컬럼이 없어서 구현하지 않음**(추가하려면 카카오 도서 API 응답을 저장하는 새 컬럼과 마이그레이션이 필요 — 지금은 범위 밖으로 판단). 차트 라이브러리 없이 순수 CSS(`div` 높이/너비 비율)로 구현해 번들 크기 영향 없음. 두 자녀 6개월치 19건 기록을 시딩해서 합계/월별 추이/기록방식 비율/독서로 현황 숫자가 실제 DB 값과 정확히 일치하는지 데스크톱·모바일 뷰포트 둘 다 실제 브라우저로 검증함
- [x] **C. 표지 촬영 자동 인식**: 바코드(ISBN) 스캔 대신 **기존 OCR 인프라를 재사용하는 방식**으로 결정 — `/read/new/book`에 "📷 표지 사진으로 찾기" 버튼 추가(사진 촬영/선택, 기존 OCR 카메라 UX와 동일한 `capture="environment"`). 흐름: 사진 → `POST /api/book-cover-lookup`(신규) → `analyzeImageBytes`(Document Intelligence, `src/lib/documentIntelligence.ts`에 추가 — 이 사진은 저장할 필요가 없는 일회성 검색 보조라 Supabase Storage에 올리지 않고 바이트를 바로 binary body로 전달, `urlSource` 대신 사용) → `guessCoverTitle`(`src/lib/azureOpenAI.ts`에 추가, 표지 OCR 원문에서 제목/지은이 추정) → `searchBooks`(`src/lib/kakaoBook.ts`에 추가, 추정 제목으로 카카오 도서 검색 후보 최대 5개 반환, 표지 썸네일 포함) → 화면에 후보 목록을 보여주고 **사람이 직접 선택**해서 책 제목/저자 필드를 채움(OCR+AI 추정을 그대로 자동 확정하지 않고 확인 단계를 둠 — Phase 1 OCR 기능과 같은 "AI는 보조, 최종 확인은 사람" 원칙). 후보가 없으면 에러 없이 안내 문구만 보여주고 직접 입력 경로로 자연스럽게 폴백. 합성 표지 이미지("무지개 물고기")로 OCR→AI 추정→카카오 검색 세 단계를 curl로 각각 먼저 검증한 뒤, claude-in-chrome으로 실제 파일 업로드 → 후보 선택 → 대화 시작까지 end-to-end 확인, 빈 이미지로 "찾지 못함" 폴백 경로도 확인함
  - **부모 접근 차단 보강 (2026-09-11)**: 사용자가 "표지 촬영 자동 인식도 자녀가 직접 쓸 수 있게 해달라"고 요청 — 확인해보니 자녀만 쓸 수 있는 기능이도록 이미 설계돼 있었으나(`/read/new`가 `requireChildProfile()`로 막음), `/read/new/book`과 `/read/ocr/new` 자체는 클라이언트 컴포넌트라 서버 쪽 권한 확인이 없어서 **부모가 URL을 직접 열면 우회 가능한 기존 결함**을 발견함. `/read/[id]/chat`과 동일한 패턴(서버 컴포넌트가 `requireChildProfile()`을 확인한 뒤 클라이언트 컴포넌트를 렌더링)으로 두 라우트 모두 고쳐서 이제 부모가 URL을 직접 입력해도 `/profiles`로 튕겨나가도록 막음(폼 로직은 `src/components/NewBookForm.tsx`/`NewOcrForm.tsx`로 이동). 실제 브라우저로 자녀 정상 플로우가 안 깨졌는지, 부모 직접 접근이 실제로 막히는지(두 라우트 다) 재확인함
- [x] **D. 형제자매 비교/배지·스탬프**: 자녀 홈(`/home`)의 "내 배지" 섹션(본인 배지만) + 부모 전용 `/settings/badges`(두 자녀 배지를 나란히 비교, `/settings`에서 진입). 배지 7종(`src/lib/badges.ts`의 `BADGE_CATALOG`): 첫 걸음(1권)·책벌레(5권)·독서왕(10권)·이야기꾼(대화 3회)·기록 탐정(OCR 3회)·독서로 지킴이(반영 5건)·이달의 다독왕(이번 달 형제자매 중 최다, 동률이면 둘 다 획득). **획득 여부를 저장하는 새 테이블 없이 매번 `reading_records`에서 즉석 계산**(`computeBadges`) — 스키마 변경 없이 구현. 자녀 세션은 RLS상 형제자매의 `reading_records`를 볼 수 없으므로(의도된 프라이버시 경계, `reading_records_select` 정책 참고), "이달의 다독왕" 계산에 한해서만 `src/lib/siblingReadingCounts.ts`가 서비스 역할로 `child_profile_id`/`recorded_at`(집계용, 책 제목·내용은 절대 조회 안 함)만 좁게 조회해 형제자매의 이번 달 권수를 가져온다 — 형제자매 목록 자체는 `profiles` RLS가 원래도 가족 구성원에게 공개하므로(프로필 선택 화면과 동일) 별도 우회가 필요 없었음. 두 자녀·기록 12건/2건을 시딩해 첫째는 7개 배지 전부, 둘째는 "첫 걸음"만 획득하도록 구성한 뒤, 자녀 로그인 화면과 부모 비교 화면 양쪽에서 배지 개수·진행률 숫자가 정확히 일치하는지 실제 브라우저로 검증함

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

## 페이지 전환 속도 개선 (2026-09-11)

사용자가 실제 기기에서 "확인 누르고 다음 화면 넘어가는 게 느리다"고 피드백(twin_choice에서도 같은 걸 느꼈다고 함 — 같은 인증 패턴을 재사용하는 자매 앱이라 원인이 같을 가능성이 높음). 원인 3가지를 찾아 전부 조치함:

1. **가장 큰 원인 — Vercel 서버 함수 리전과 Supabase 리전 불일치.** `curl -X POST .../api/children`의 `x-vercel-id` 응답 헤더가 `icn1::iad1::...`로 나옴 — 요청은 서울(icn1) 엣지로 들어오지만 실제 Node 서버 함수는 버지니아(iad1)에서 실행되고 있었다. Supabase 프로젝트는 서울(ap-northeast-2)이라, 서버 컴포넌트 하나가 렌더링될 때마다 안에서 만드는 모든 Supabase 호출이 한국→미국→서울→미국→한국을 왕복한다. `vercel.json`에 `{"regions": ["icn1"]}`을 추가해 서버 함수를 서울로 고정함 — Hobby(무료) 플랜에서 이 설정이 실제로 반영되는지는 다음 배포 후 `x-vercel-id`로 재확인 필요(반영 안 되면 Vercel 프로젝트 설정 → Functions → Function Region에서 수동 지정).
2. **페이지마다 Supabase 조회를 순서대로 하나씩 `await`.** 예를 들어 `/home`은 자녀 프로필 조회 후 아바타 서명 URL·진행 중인 대화·최근 기록 5건·전체 기록(배지용, 최근 5건과 같은 테이블을 필터만 다르게 또 조회)·형제자매 목록까지 6~7번을 전부 직렬로 기다렸다. 서로 의존하지 않는 조회는 `Promise.all`로 묶고, 최근 5건/전체 기록처럼 같은 테이블·같은 필터의 중복 조회는 하나로 합쳐서 자바스크립트에서 슬라이스하도록 정리함 (`src/app/home/page.tsx`, `src/app/settings/stats/page.tsx`, `src/app/settings/badges/page.tsx`, `src/app/settings/records/page.tsx`). `records/[id]`처럼 다음 조회가 이전 결과값(예: `child_profile_id`)에 의존하는 경우는 원래도 병렬화가 불가능해서 그대로 둠.
3. **인증 확인이 요청마다 두 번.** `middleware.ts`가 모든 요청에서 `supabase.auth.getUser()`로 세션을 이미 검증/갱신하는데, `src/lib/currentProfile.ts`의 `getCurrentProfile()`이 페이지 렌더 때 또 `getUser()`를 호출해 Supabase Auth 서버에 왕복 하나를 더 만들고 있었다. 미들웨어가 같은 요청 생명주기 안에서 이미 검증을 마쳤으므로, 페이지 쪽은 쿠키의 JWT를 네트워크 없이 로컬에서 읽는 `getSession()`으로 바꿔 왕복 하나를 없앰 — 이 함수가 거의 모든 페이지에서 호출되는 만큼 전역적으로 효과가 있다.

`router.push(...); router.refresh();` 패턴(로그인/PIN/로그아웃 직후 여러 곳에 있음)은 일부러 그대로 뒀다 — 형제자매가 같은 URL(`/home` 등)을 서로 다른 세션으로 방문할 때 Next.js Router Cache가 이전 아이의 캐시된 화면을 보여줄 위험이 있어서 넣어둔 방어 코드로 보이고, 섣불리 지우면 "동생 로그인했는데 형 데이터가 잠깐 보이는" 종류의 버그가 재발할 수 있다. 대신 위 3가지로 그 안에서 일어나는 실제 데이터 조회 자체를 빠르게 만드는 방향으로 접근함.

## 유닛 테스트 도입 (2026-09-12)

지금까지 전부 실제 브라우저 수동 검증으로만 확인해왔고 자동 테스트가 하나도 없었다 — 코드 리뷰에서 지적된 항목. Next.js 서버 컴포넌트/API 라우트/RLS 같은 통합 동작까지 자동화하려면 Supabase/Azure를 모킹하는 큰 작업이 필요해서 범위 밖으로 남겨두고, **외부 의존성이 전혀 없는 순수 함수부터** Vitest로 유닛 테스트를 추가했다: `src/lib/readingSession.ts`(단계별 질문 매핑/폴백), `src/lib/badges.ts`(배지 계산, 형제자매 비교 경계값 포함), `src/lib/readingStats.ts`(월별 집계), `src/lib/childAuth.ts`(PIN 검증/잠금 판정, PIN→비밀번호 파생의 결정론성, bcrypt 해시). 최초 도입 시 총 31개 테스트, `npm run test`로 실행(README "테스트" 절 참고).

> **업데이트(2026-09-12, 이후 기능 추가마다 계속 보강)**: 도서 검색 다중 소스화(`bookSearch.ts`의 `dedupeCandidates`, `libraryBook.ts`의 저자 필드 정리), AI 질문 코치 프리셋(`coachPresets.ts`), 기록 검색의 ilike 패턴 이스케이프(`RecordsBrowser.tsx`의 `toIlikePattern`), 코치 설정 화면의 프리셋 일치 판정(`CoachSettingsForm.tsx`의 `matchingPresetId`) 테스트가 추가되며 총 9개 파일 54개 테스트로 늘어났다. 새 순수 로직을 추가할 때는 계속 테스트를 같이 추가할 것.

- `server-only`로 막힌 모듈(`childAuth.ts` 등)을 일반 Node 런타임(vitest)에서 그냥 import하면 그 패키지 자체가 무조건 예외를 던진다(react-server 조건이 있을 때만 빈 모듈로 치환되는 구조라, Next.js 빌드 밖에서는 항상 실제 `index.js`가 로드됨) — `vitest.config.mts`에서 `server-only`를 `test/stubs/server-only.ts`(빈 모듈)로 alias해서 우회함
- vitest 최신 메이저(5.x)는 peer로 `@types/node@^22`/`vite@^6~8`을 요구해 이 프로젝트의 `@types/node@^20`과 충돌 — 굳이 그 버전을 맞추려고 프로젝트 전체의 `@types/node`를 올리는 대신, vite를 직접 의존성으로 갖고 있고 peer 요구가 느슨한 `vitest@^2.1.9`로 설치함
- 이 커밋 이후 새로 추가하는 순수 로직(외부 API 호출 없이 입력→출력만 있는 함수)에는 유닛 테스트를 같이 추가하는 게 좋다 — 이미 `vitest.config.mts`가 `src/**/*.test.ts`를 자동으로 주워간다

## 사용자 피드백 4건 반영 (2026-09-12)

1. **카카오 도서 정보 조회 결과를 화면에 노출**: `next-question` 라우트가 매 턴 조회하던 `bookContext`(카카오 줄거리 요약)가 지금까지 질문 생성에만 쓰이고 화면 어디에도 드러나지 않았다. `ChatSession`이 이제 API 응답의 `bookContext`를 받아 찾았으면 "📖 참고한 책 정보 보기"로 펼쳐볼 수 있게 하고, 못 찾았으면 "책 정보를 찾지 못해서 제목만으로 질문하고 있어요"라고 알려준다. 세션에 영구 저장하지는 않는, 그 턴의 채팅 화면에서만 보이는 정보다.
2. **부모 화면에서 아이 답변 vs AI 감상문 구분**: `RecordDetail`(`/records/[id]`)이 대화로 만든 기록일 때 AI가 정리한 감상문(`content`)과 아이가 실제로 답변한 원본 대화(`conversation_sessions.messages`)를 명확히 구분해서 보여준다 — "🤖 AI가 정리한 감상문"이라는 라벨과 "🗣️ 아이가 답변한 원본 대화 보기" 토글을 추가했다. 저장 직후 리뷰 화면(`ReviewSession`)에는 원래도 "원본 대화 펼쳐보기"가 있었지만, 저장된 기록을 나중에 다시 볼 때(부모의 `/settings/records` 경유 포함)는 대조할 방법이 없었다.
3. **AI 질문 패턴을 부모가 수정 가능하게**: 매번 같은 질문 패턴이 지루할 수 있다는 피드백. 전체 시스템 프롬프트 자유 입력이나 프리셋 선택 대신, **단계별 지침 문구만 수정**하는 방식을 사용자가 직접 선택함(AI가 이상하게 동작할 위험이 적고 구현 범위가 명확). `families.custom_stage_instructions`(jsonb, `0009_custom_stage_instructions.sql`)에 `{"1": "...", "2": "...", "3": "..."}` 형태로 저장하고, 없으면 `src/lib/readingSession.ts`의 `DEFAULT_STAGE_INSTRUCTIONS`로 폴백(`resolveStageInstruction`). 부모 전용 `/settings/coach` 화면에서 단계별 지침을 수정/저장/기본값 되돌리기 할 수 있고, `/api/family/coach-settings`(PATCH, admin 클라이언트)가 저장을 처리한다. `next-question` 라우트가 세션 조회와 병렬로 이 값을 가져와 `generateNextQuestion`에 전달한다. `families` 테이블은 원래 select 정책만 있고 쓰기는 서버(service role)에서만 하므로 새 RLS 정책은 필요 없었다. **`0009_custom_stage_instructions.sql`을 실제 Supabase 프로젝트에 적용 완료** — `/settings/coach` 기능이 실제 DB에서도 동작한다.
4. **'독서로' 등록 완료 표시는 부모만**: `RecordDetail`의 "✅ '독서로'에 등록했어요" / "등록 취소로 되돌리기" 토글을 지금까지는 자녀도 누를 수 있었다(실제 '독서로' 사이트 로그인·등록은 부모가 하는 일인데 상태 표시는 누구나 바꿀 수 있었던 불일치). `canManageDokseoro` prop으로 화면에서 부모가 아니면 버튼 대신 안내 문구만 보이게 했고, `/api/reading-records/[id]` PATCH도 `dokseoroStatus` 필드가 요청에 있을 때 `profile.role !== 'parent'`면 403을 반환하도록 서버 쪽에도 같은 규칙을 넣었다(RLS는 가족/본인 여부만 가리고 역할별 필드 제한은 못 하므로 라우트가 직접 확인).

## 책 제목 검색: 네이버 병행 + 오타 교정 (2026-09-12)

책 제목 자동완성/표지 인식에서 그림책·동화책이 카카오 도서 검색에 잘 안 걸린다는 피드백. "API를 하나만 써야 하냐"는 질문에 그런 제약은 없어서, 네이버 도서 검색 API를 두 번째 출처로 추가해 병행하기로 함 — 오타 허용 검색은 API 자체엔 없는 기능이라(둘 다 키워드 매칭이라 철자가 틀리면 결과가 안 나옴) AI로 별도 보완.

- `src/lib/naverBook.ts` 추가(`searchNaverBooks`) — 카카오(`kakaoBook.ts`)와 동일한 `BookCandidate` 형태로 반환. `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 둘 다 없으면 빈 배열만 돌려줘서 선택적 기능으로 동작(카카오만으로도 계속 정상 동작)
- `src/lib/bookSearch.ts` 신설 — `searchBooksMultiSource()`가 카카오+네이버를 병렬 조회해서 합치고, 제목+저자 기준으로 중복 제거(`dedupeCandidates`, 유닛 테스트 있음). `/api/book-search`(타이핑 자동완성)와 `/api/book-cover-lookup`(표지 인식) 둘 다 기존 `searchBooks`(카카오 단독) 대신 이 함수를 쓰도록 교체
- `guessCorrectedBookTitle`(`azureOpenAI.ts`, 저지연 모델) 추가 — 카카오+네이버 검색이 0건일 때만 호출해서 오타/띄어쓰기를 교정한 제목을 추측하고 그걸로 한 번 더 검색한다. 검색이 첫 시도에 성공하면 이 AI 호출 자체가 일어나지 않아 평소엔 추가 비용이 없음
- 네이버 키는 `.env.local.example`/README "도서 검색 API 셋업"에 발급 절차(developers.naver.com, WEB 서비스 URL 등록 필수)를 안내해뒀다 — **사용자가 아직 발급 전이라, 실제 환경에서 네이버 검색이 동작하려면 키를 발급받아 `.env.local`과 Vercel Environment Variables에 등록해야 함**. 안 해도 카카오만으로 기존처럼 동작.

> **업데이트(2026-09-12, 같은 날)**: 사용자가 네이버 애플리케이션 등록 화면을 실제로 열어보니 "사용 API" 목록에 "검색" 항목 자체가 없었다 — 확인해보니 **네이버 도서/쇼핑/전문자료 검색 오픈API가 2026-07-31부로 완전 종료**(대체 API 없음)됐다. 원래 PRD 6.2에서 카카오의 대안으로 검토했던 **알라딘 Open API도 2026-09-04부로 신규 TTBKey 발급 중단, 2026-10-30 서비스 완전 종료** 예정이라 병행 불가 — 국내 상용 도서 검색 API 두 곳이 거의 동시에 문을 닫은 상황. `naverBook.ts`/`searchBooksMultiSource`의 네이버 코드는 그대로 남겨뒀다(예전에 키를 발급받은 사람이면 계속 쓸 수 있고, 키가 없으면 조용히 빠짐 — 해는 없음). 대신 아래 도서관정보나루를 세 번째 출처로 추가함.

## 책 제목 검색: 도서관정보나루 추가 (2026-09-12)

네이버/알라딘이 둘 다 막히면서, 상용 API 대신 **국립중앙도서관이 운영하는 공공 오픈데이터 도서관정보나루(data4library.kr)**를 대안으로 검토·추가했다. 전국 공공/학교 도서관 소장 데이터 기반이라 절판되거나 오래된 그림책·동화책이 서점 판매 API보다 오히려 잘 걸릴 것으로 기대. 네이버/알라딘과 무관한 정부 공공데이터라 이번 같은 서비스 종료 리스크도 낮다.

- `src/lib/libraryBook.ts` 추가(`searchLibraryBooks`) — `srchBooks`(키워드 검색) 엔드포인트 사용. 서지정보 위주라 카카오/네이버와 달리 **줄거리 설명은 제공하지 않는다**(표지 이미지만, `description`은 항상 null). `authors` 필드가 "지은이 지음ㅣ옮긴이 옮김"처럼 역할 표기가 섞여 들어와서 `firstAuthor()`로 첫 사람만 뽑고 흔한 역할 표기(지음/글/그림/저/엮음)를 정리(유닛 테스트 있음) — 완벽한 파싱은 아님
- `bookSearch.ts`의 `searchBooksMultiSource()`가 카카오+네이버+도서관정보나루 세 출처를 병렬 조회하도록 확장
- 이 세션 환경(샌드박스)의 아웃바운드 네트워크가 화이트리스트로 제한돼 있어서 `data4library.kr`을 직접 호출해서 검증하지는 못했지만, **사용자가 공식 API 매뉴얼(v20260210, "16. 도서 검색" 섹션) PDF를 직접 보내줘서 파라미터/응답 필드를 정확히 대조했다.**
  - **`keyword` 파라미터를 쓰면 안 된다** — 매뉴얼에 "키워드를 입력할 경우 일치검색 결과만 제공"이라고 명시돼 있어서, 제목을 끝까지 입력해야만(완전 일치) 후보가 뜨고 타이핑 도중(부분 입력)에는 아무것도 안 걸렸을 것. 처음엔 이 실수를 그대로 구현했었고, 매뉴얼을 받은 뒤 `title` 파라미터(기본이 비일치검색=부분 일치)로 고쳤다 — 자동완성처럼 "다 안 쳐도 후보가 뜨는" 용도엔 `title`이 맞다
  - 응답 필드명(`response.docs[].doc.bookname/authors/bookImageURL` 등)은 처음 짐작한 그대로 정확히 맞았음(공개 커뮤니티 자료로 추정한 것들이 실제 매뉴얼과 일치)
- 사용자가 발급받은 인증키가 **"승인대기중"** 상태로 뜸 — 승인 전에는 호출이 실패(빈 배열 반환)할 수 있고, 승인되면 그때부터 실제로 검색에 반영됨. 승인 소요 시간은 문서에 명시돼 있지 않음
- `DATA4LIBRARY_AUTH_KEY`를 `.env.local.example`/README에 안내 추가. 서버 IP는 하루 500건 이상 호출할 때만 필요(이 앱 트래픽으로는 불필요, 애초에 Vercel 서버리스는 고정 IP가 없어서 등록도 못 함)
- 매뉴얼의 다른 섹션(1~5번, 16번 외)을 훑어보다 향후 검토해볼 만한 기능도 발견함: **인기대출도서 조회**(`loanItemSrch`, 연령/지역/기간별 인기 대출 도서 — "또래 친구들이 많이 읽는 책" 추천에 쓸 수 있음), **마니아/다독자 추천도서**(`recommandList`, ISBN 기반 "이 책 읽은 사람들이 같이 읽은 책" 추천 — 감상문 저장 직후 "다음 책 추천"에 쓸 수 있으나 `reading_records`에 ISBN을 저장하는 컬럼이 없어서 스키마 변경이 선행돼야 함). 둘 다 지금은 범위 밖, 사용자가 원하면 나중에 검토

## AI 질문 코치 프리셋 버튼 추가 (2026-09-12)

`/settings/coach`에서 매번 단계별 지침 세 개를 직접 쓰지 않아도, 완성된 지침 세트를 버튼 하나로 불러올 수 있게 프리셋 3종(이야기 탐정/라디오 사연 인터뷰/모험 동료, `src/lib/coachPresets.ts`)을 추가했다. 감상문 3단 조립이 의존하는 뼈대(1단계=줄거리 확인, 2단계=공감, 3단계=현실 연결)는 그대로 두고 질문의 말투/컨셉만 바뀐다. 프리셋을 누르면 입력창 내용만 바뀌고 "저장"을 눌러야 실제 가족 설정에 반영되는 기존 원칙(화면 미리보기와 서버 반영 시점 분리, 기본값 되돌리기와 동일한 패턴)을 그대로 따른다.

## 책 제목 자동완성 추가 (2026-09-12)

`/read/new/book`의 책 제목 입력에 카카오 도서 검색 자동완성을 추가했다(`/api/book-search` 신규, 2글자 이상 입력 + 500ms 디바운스). 표지 촬영 후보 검색과 같은 "정확한 값은 검색 결과에서 사람이 고르되, 없으면 직접 입력을 허용한다" 원칙을 텍스트 입력에도 적용 — 검색 결과가 없어도 지금까지처럼 직접 입력한 텍스트로 그대로 진행할 수 있다. 처음엔 검색 결과가 0건이어도 아무 표시가 없어 "검색이 됐는지 안 됐는지, 이대로 진행해도 되는지" 알 수 없다는 문제가 있어서, "검색에서 이 책을 찾지 못했어요 — 지금 입력한 제목으로 그대로 진행할 수 있어요" 안내 문구를 추가했다(디바운스 대기 중과 "찾아봤지만 결과 없음"을 구분하기 위해 실제로 검색이 끝난 검색어를 별도로 추적). `/api/book-search`도 다른 자녀 전용 API와 동일하게 `requireChildProfileForApi`로 가드했다.

## 기록 목록 개편: 무한 스크롤/검색/날짜 필터 + 자녀별 탭 (2026-09-12)

기록이 쌓여도 한 번에 다 불러와 나열만 하던 `/records`(자녀)·`/settings/records`(부모)를 다시 설계했다.

- 처음엔 클라이언트 배열 필터(제목/내용만, 이미 불러온 페이지 안에서만 검색 가능)로 시작했으나 뒤쪽 미로딩 페이지는 검색이 안 되는 한계가 있어, 검색어/날짜가 있으면 서버 쿼리로 페이지네이션하는 `RecordsBrowser`로 교체했다 — 자녀 화면(`/records`)과 부모 대시보드(`/settings/records`) 공용 컴포넌트다. RLS(`reading_records_select`)가 "본인 것만" vs "가족 전체"를 이미 갈라주므로 컴포넌트는 role을 신경 쓸 필요가 없다.
- 서버 컴포넌트가 첫 페이지(`RECORDS_PAGE_SIZE=15`)만 미리 받아 빠르게 그리고, 나머지는 `RecordsBrowser`가 스크롤(`IntersectionObserver`)/검색에 따라 브라우저에서 직접 Supabase를 호출해 이어붙인다. 검색창(책 제목/내용, 디바운스)과 시작일/종료일 날짜 필터를 추가했고, 필터가 바뀌면 처음부터 다시 불러온다. "· N권" 표시는 head-count 쿼리(행은 안 받아옴)로 구해서 전체 기록을 다 받아오지 않는다.
- 응답이 요청 순서와 다르게 도착해도 최신 요청 결과만 반영하는 가드(`requestIdRef`)를 넣었다 — 책 제목 자동완성에서 겪은 것과 같은 종류의 경쟁 상태를 미리 방지한 것.
- 부모 대시보드는 자녀가 늘어나면(4명으로 테스트) 세로 나열이 너무 길어져서 `ChildRecordsTabs`로 자녀별 탭 전환 방식으로 바꿨다. 탭을 바꿀 때 `RecordsBrowser`에 `key`를 줘서 강제로 리마운트시켜, 이전 아이의 검색/스크롤 상태가 새 아이 화면에 남지 않게 했다.
- **"데이터는 있는데 화면이 빈 목록"류 버그 두 건을 이 과정에서 발견·수정함** — 앞으로 같은 증상을 보면 이 두 가지부터 의심할 것:
  1. `RECORDS_PAGE_SIZE` 상수가 `"use client"` 컴포넌트(`RecordsBrowser.tsx`)에서 export되고 있었는데, 이를 import하는 서버 컴포넌트(`records/page.tsx` 등)에서는 Next.js가 실제 값 대신 클라이언트 레퍼런스 프록시 객체로 치환한다 — `.range(0, RECORDS_PAGE_SIZE - 1)`이 `.range(0, NaN)`이 되어 PostgREST가 항상 빈 배열을 반환했다("· 11권"처럼 head-count는 `.range()`가 없어 정상이라 "권수는 맞는데 목록은 비어있는" 증상으로 나타남). 상수를 일반 모듈(`src/lib/recordsPaging.ts`)로 분리해 해결.
  2. Next.js 14는 `cookies()`로 동적 렌더링되는 라우트여도 그 안의 개별 `fetch()`는 기본값(`force-cache`)을 그대로 따른다 — "동적 렌더링"과 "fetch 캐싱"은 서로 다른 축이라, Supabase 서버 클라이언트(`src/lib/supabase/server.ts`)가 커스텀 fetch/cache 옵션을 지정하지 않아 PostgREST 호출 결과가 캐시돼 재사용될 수 있었다. Supabase로 사용자별 데이터를 조회하는 모든 페이지에 `export const dynamic = "force-dynamic"`을 명시해 해결.
- `toIlikePattern()`(ilike 검색어의 `%`/`_` 와일드카드, `or()` 필터 문법의 구분자인 콤마·큰따옴표 이스케이프)은 유닛 테스트로 커버.

## UI 다듬기 3건 (2026-09-12)

사용자 피드백으로 작은 화면 문제 3건을 고쳤다:
1. **뒤로가기 위치**: `/settings/records`처럼 자녀별 기록이 많이 쌓이면 리스트가 길어지는 화면에서 "뒤로"가 맨 아래에만 있어 나가려면 끝까지 스크롤해야 했다. 8개 화면에 반복되던 하단 "뒤로" 링크를 공용 `BackLink` 컴포넌트로 빼서 화면 맨 위(제목 바로 위)에 작은 버튼으로 배치했다.
2. **"나가기"/"전체 보기" 버튼 모양 통일**: 자녀 홈에서 "나가기"는 `LogoutButton`의 기본 스타일(전체 너비 ghost 버튼)이 좁은 자리에 들어가다 보니 테두리 없는 글씨처럼 보였고, "전체 보기"는 아예 버튼이 아니라 밑줄 텍스트 링크였다. 공용 `.btn-pill`(테두리 있는 알약 모양, `BackLink`의 "← 뒤로"와 같은 스타일) 클래스를 `globals.css`에 추가해 통일 — `LogoutButton`은 className을 오버라이드할 수 있게 해서 설정/프로필 선택 화면의 기존 전체 너비 배치는 그대로 두고 자녀 홈에서만 알약 버튼으로 바꿨다.
3. **독서 통계 화면 이름 줄바꿈**: `grid-template-columns`가 자녀 수만큼 고정 컬럼을 강제해서(`repeat(N, 1fr)`) 자녀가 4명이 되니 카드 폭이 너무 좁아져 이름이 "고/아/린"처럼 글자 단위로 줄바꿈됐다. `auto-fit + minmax(110px, 1fr)`로 바꿔 카드가 너무 좁아지면 다음 줄로 넘어가게 하고, 이름/"이번 달 N권" 텍스트에 `whitespace-nowrap`을 줘서 줄바꿈 대신 카드가 필요한 만큼만 커지도록 했다. 차트 아래 범례도 같은 이유로 `flex-wrap` 추가.

## 대화 중단 방식 개선 (2026-09-12)

기존 "그만할래" 버튼은 사실 "지금까지 답으로 감상문 만들러 가기"였는데, 이름만 보면 완전히 포기하는 것처럼 보여 헷갈린다는 피드백을 받았다. 의미가 다른 두 동작으로 분리했다:
- **"다음에 작성"**: 그냥 홈으로 나간다. 세션은 이미 `in_progress`로 저장돼 있어서 홈의 "이어서 쓰기"로 다시 들어올 수 있다.
- **"취소"**: 대화 자체를 완전히 지운다(되돌릴 수 없음, 답변이 있으면 confirm으로 한 번 더 확인). `conversation_sessions`에는 RLS delete 정책이 없어 런타임 삭제가 막혀 있어서, 본인 소유의 `in_progress` 세션인지 먼저 확인한 뒤 admin 클라이언트로 지우는 API 라우트(`DELETE /api/reading-sessions/[id]`)를 새로 추가했다.

## 음성 인식 수정 + 감상문 검수 화면 개선 (2026-09-12)

- **음성 입력이 매번 실패하던 원인 발견**: 기존 마이크 녹음(`MediaRecorder` 기본 webm/opus 포맷)을 Azure STT 단문 인식 REST API가 지원하지 않고 있었다. Web Audio API로 raw PCM을 직접 캡처해 16kHz mono WAV로 인코딩하는 방식(`src/lib/pcmRecorder.ts`)으로 교체해 실제로 동작하게 함. (Phase 1 "2. 대화 기반 독서 기록" 항목에 "자동화 브라우저에 마이크가 없어 실제 기기 테스트 필요"로 남겨뒀던 항목을 실제 기기로 확인하는 과정에서 발견·수정한 것으로 보임.)
- **감상문 검수 화면(`ReviewSession`) 개선**: "AI 도움이 큰 만큼 아이가 최소 한 번은 감상문을 읽고 등록되면 좋겠다"는 취지로, 생성 직후 바로 편집/저장 화면으로 가는 대신 먼저 "내가 한 말 → 감상문" 비교 화면을 보여주고 "다 읽었어요, 확인했어요"를 눌러야 편집/저장 화면으로 넘어가게 했다. 감상문 문단(처음/가운데/끝)마다 아이가 실제로 한 말(단계별 원본 답변)을 나란히 보여주고, AI가 문단마다 문장을 어떻게 다듬었는지 짧은 "문장 쓰기 팁"을 생성해 함께 표시한다(`generateEssay`가 `essay` 외에 `stageAnswers`/`notes`도 함께 반환하도록 확장, `write_essay` 함수 호출 스키마에 필드 추가). 팁은 아이가 실제로 한 말과 감상문 문장을 비교해 표현이 어떻게 달라졌는지만 짚도록 프롬프트에 명시해, 새로운 내용을 지어내지 않는다는 PRD 8절의 창작 금지 원칙과 배치되지 않게 했다.

## 문서 정비: ARCHITECTURE/BRIEF/STORIES 신설 (2026-09-12)

지금까지 CLAUDE.md 하나에만 누적돼 있던 구현 이력을 목적별로 재구성했다: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)(실제 구현 기준 기술 참조 — PRD 6장의 최초 계획과 다른 부분을 정리), [docs/BRIEF.md](docs/BRIEF.md)(프로젝트 5분 요약), [docs/STORIES.md](docs/STORIES.md)(기능 단위 사용자 스토리, 전부 구현 완료 상태로 표시)를 신설하고 [docs/PRD.md](docs/PRD.md)에 관련 구현 노트를 보강했다(v1.5→v1.6). CLAUDE.md는 계속 "세션별 작업 로그"(무엇을 언제 왜 했는지, 발견한 함정/교훈) 역할을 유지하고, 구조적으로 정리된 최신 상태는 새 문서들이 담당한다 — **새 기능을 구현하면 CLAUDE.md에 로그를 남기는 것과 별개로, docs/STORIES.md에 스토리를, 아키텍처가 바뀌었으면 docs/ARCHITECTURE.md도 갱신할 것.**

## 대화 질문 그라운딩 강화 + 팔로업 질문 추가 (2026-09-12)

세 가지 사용자 피드백을 연달아 반영했다(순서대로 이어진 개선):

1. **"질문이 책의 내용과 상관없이 진행되는 거 같아"**: 기존 단계별 지침(`DEFAULT_STAGE_INSTRUCTIONS`)이 "가장 큰 사건이 뭐였어?"처럼 질문 문장 자체를 거의 정해줘서, AI가 카카오 줄거리 요약(`bookContext`)을 굳이 참고하지 않아도 어떤 책에나 갖다 붙일 수 있는 질문을 내놓고 있었다. 시스템 프롬프트에 "줄거리 요약에 나온 구체적 사건/인물 이름을 최소 하나는 넣어라"는 규칙을 명시하고, 단계별 지침을 완성된 질문 문장 대신 "구체성을 요구하는 지시"로 다시 써서 매번 그 책에 맞는 다른 질문이 나오도록 유도했다.
2. **그라운딩 폴백 보강**: "해리 포터와 마법사의 돌 1(해리포터 20주년 개정판)"으로 테스트했더니 질문이 안 바뀐 것처럼 보인다는 피드백을 받고 원인을 찾음 — 이 판본은 카카오 도서 검색 후보 10개 전부가 실제 줄거리 없이 "20주년 기념 개정판 출간" 같은 출판사 마케팅 문구뿐이었다(이전 테스트는 우연히 실제 줄거리가 있는 다른 판본과 매칭됐던 것). 요약이 줄거리가 아니라 책 소개/출판 정보뿐이면 그 문구를 무시하고, 유명한 책이면 모델이 원래 알고 있는 줄거리 지식으로 대체하도록 허용 — 잘 모르는 책이면 기존처럼 제목만으로 자연스럽게 질문한다.
3. **"AI 개입이 더 적극적이면 좋겠다"**: 아이가 "몰라"처럼 성의 없이 답해도 AI가 그냥 다음 단계로 넘어가서, 답변은 부실한데 AI가 다듬은 감상문만 잘 나오는 간극이 있었다. `readingSession.ts`의 `isAnswerTooShort()`로 짧거나(3자 이하) 흔한 회피성 답변("몰라"/"몰라요"/"글쎄"/"패스"/"안읽음" 등)을 별도 AI 호출 없이 코드에서 즉시 판정(비용 없음)하고, 단계당 최대 1회(`MAX_FOLLOW_UPS_PER_STAGE`)까지 같은 주제를 혼내는 느낌 없이 다정하게 다시 캐묻는 "팔로업" 질문을 끼워 넣는다. 팔로업 질문은 `ConversationMessage.isFollowUp` 플래그로 표시되며 정규 4단계 진행 카운트에는 포함되지 않지만, 감상문 조립 시 해당 단계 답변 풀에는 포함된다. `next-question` 라우트가 서버에서 계산한 "계획된 질문 기준" 진행률(`progress`)을 응답에 포함시키고, `ChatSession`은 이 값을 그대로 표시하며 팔로업 질문일 때는 "· 조금 더 자세히 들려줄래?"를 덧붙인다.

## 책 제목 정확성 + 페이지 수 기록 추가 (2026-09-12)

사용자 요청: "책을 기록할 때 책 제목이 정확해야하고, 책의 페이지 수가 기록되어야해." 카카오·도서관정보나루 도서 검색 API 둘 다 페이지 수를 제공하지 않는다는 걸 확인하고(서지정보/줄거리 위주), ISBN 상세조회 API 추가 연동은 이 세션에서 검증할 수 없어 범위 밖으로 두고 **사람이 직접 입력**하는 방식으로 구현했다(사용자에게 설계 확인을 요청했으나 응답을 받지 못해, 아래처럼 이 코드베이스의 기존 원칙에 맞춰 합리적인 기본값으로 진행함).

- **페이지 수**: `conversation_sessions.book_page_count`/`reading_records.page_count`(둘 다 nullable int, `0010_page_count.sql`) 추가. 대화 시작 화면(`NewBookForm`)과 독서노트 OCR 검수 화면(`OcrReview`)에서 **필수 입력**(양의 정수, 클라이언트+서버 이중 검증)으로 받는다 — 대화 흐름은 `book_page_count`에 먼저 저장했다가 감상문 저장 시점(`reading-sessions/[id]/finish`)에 `reading_records.page_count`로 복사한다. OCR/AI 구조화(`parseOcrRecord`)는 페이지 수를 추측하지 않는다 — 숫자는 특히 잘못 지어내기 쉬워서 PRD 8절의 "사실을 창작하지 않는다" 원칙을 그대로 적용, 항상 사람이 입력. 기존 기록은 값이 없을 수 있어(nullable) 강제 백필 없이, 기록 상세(`RecordDetail`, 자녀/부모 모두)에서 나중에 채워 넣을 수 있게 편집 가능한 필드로 둠. 목록(`RecordCard`)과 '독서로' 등록용 복사 텍스트(`RecordDetail`의 "전체 복사하기")에도 반영.
- **책 제목 정확성**: 기존에 이미 "카카오/도서관정보나루 자동완성에서 정확한 제목을 고르되, 없으면 직접 입력을 허용한다" 원칙이 있어서(자동완성 자체가 이미 정확성 장치), 이 원칙을 뒤집는 대신(자유 입력을 막으면 카카오/도서관정보나루에 없는 책은 기록을 못 남기게 됨) 최소한의 보강만 했다: 대화 시작 화면·OCR 검수 화면 둘 다 제목 입력 placeholder를 "책 표지에 적힌 그대로"로 바꾸고, 2자 미만처럼 명백히 잘못된 값(장르명 오타, 한 글자 등)은 클라이언트+서버에서 거부한다. 이 이상의 강제(자동완성 선택 강제, 저장 전 별도 확인 화면 추가 등)는 UX 트레이드오프가 커서 사용자 확인 없이 임의로 정하지 않았다 — 필요하면 후속 요청으로 구체화할 것.
- 마이그레이션은 다른 것들과 마찬가지로 Supabase 대시보드 SQL Editor에서 번호 순서대로 수동 실행해야 실제 프로젝트에 반영된다. **`0010_page_count.sql`을 실제 Supabase 프로젝트에 적용 완료** — `page_count`/`book_page_count` 컬럼이 실제 DB에도 반영됨.

> **업데이트(2026-09-12, 페이지 수 자동 조회 검토)**: 사용자가 "도서관정보나루 상세조회 API로 자동 조회 가능한지" 질문 — 공식 매뉴얼 원문(`srchDtlList`)을 직접 받아 확인한 결과 `book` 응답 객체(`no/bookname/authors/publisher/publication_date/publication_year/isbn/isbn13/addition_symbol/vol/class_no/class_nm/description/bookImageURL`)에 페이지 수 필드가 아예 없음을 확인함. 대안으로 국립중앙도서관의 별도 서비스인 서지정보유통지원시스템(SEOJI, `seoji.nl.go.kr`)에 `PAGE`(문자열, "252 p." 형식) 필드가 있다는 걸 찾았으나, 별도 인증키가 필요하고 실사용 후기 기준 "페이지 수 없는 책이 많다"는 커버리지 문제가 있어 보류.
>
> 이어서 사용자가 네이버쇼핑 책 카탈로그 페이지(`search.shopping.naver.com/book/catalog/...`)에는 쪽수가 잘 나온다며 활용법을 물었음 — 확인해보니 이건 판매용 카탈로그 데이터라 개발자 API로 공개돼 있지 않고, 실제로 이 세션에서 그 페이지를 서버 쪽에서 가져오려는 시도(WebFetch)가 차단당함. 네이버가 쇼핑몰 크롤링을 적극적으로 차단하고 있다는 최근 보도도 확인해서, **서버 자동 스크래핑 대신 사람이 새 탭에서 직접 열어보는 검색 링크만 제공**하기로 함(`src/lib/externalBookSearch.ts`의 `naverBookSearchUrl`) — '독서로' 자동 등록 대신 수동 가이드를 택한 것과 같은 판단 기준(이용약관/안정성 리스크 회피, "AI/자동화는 보조, 최종 확인은 사람"). 페이지 수를 입력하는 세 화면(`NewBookForm`, `OcrReview`, `RecordDetail`) 모두 입력란 옆에 "🔍 찾아보기" 링크를 추가해 책 제목(+저자)으로 네이버쇼핑 검색 결과를 새 탭으로 열어준다 — `RecordDetail`은 사용자가 요청한 "'독서로' 작성 시 필요하면 검색" 시나리오와 정확히 맞아떨어지는 위치(페이지 수 입력란 바로 아래에 '독서로' 등록 카드가 있음).

## 부모 기록 화면: 자녀 탭 선택 상태가 "뒤로" 후 리셋되던 버그 수정 (2026-09-12)

`/settings/records`(부모 대시보드)에서 두 번째 이상 자녀 탭(예: 황유니)을 고른 뒤 기록 하나를 열어보고 "뒤로"를 누르면, 방금 보던 자녀가 아니라 항상 첫 번째 자녀(고아린) 탭으로 되돌아가는 버그를 사용자가 발견함("아이를 선택하고 독서 기록을 본후 뒤로 나올때 그 선택된 상태로 유지되어야해").

원인: `ChildRecordsTabs`의 선택된 탭(`activeId`)이 컴포넌트 로컬 `useState`였는데, `/settings/records`는 서버 컴포넌트 페이지라 `records/[id]`로 들어갔다가 "뒤로"(`BackLink`, 고정 `href`로 이동하는 일반 `Link` — 브라우저 히스토리 back이 아님)로 돌아오면 페이지 자체가 완전히 새로 마운트되면서 `useState`가 항상 초기값(`childrenData[0]`)으로 되돌아갔다.

- 선택된 탭을 로컬 state 대신 **URL 쿼리 파라미터(`?child=<id>`)**로 관리하도록 바꿈 — 탭 클릭 시 `router.replace`로 URL을 갱신하고, 마운트 시 그 쿼리값을 초기 탭으로 읽는다.
- `records/[id]/page.tsx`의 부모용 `backHref`가 `/settings/records`(고정) 대신 `/settings/records?child=${record.child_profile_id}`를 넘기도록 수정 — 기록의 주인이 누구인지는 이미 알고 있으니, 그 자녀 id를 그대로 쿼리에 실어 보내면 "뒤로" 갔을 때 자연스럽게 그 자녀 탭이 선택된다.
- `useSearchParams()`를 쓰는 클라이언트 컴포넌트는 Next.js가 `<Suspense>`로 감싸도록 요구해서(안 그러면 `next build` 시 "missing-suspense-with-csr-bailout" 오류), `settings/records/page.tsx`에서 `<ChildRecordsTabs>`를 `<Suspense fallback={null}>`로 감쌈.
- 배포 후 사용자가 프로덕션에서 직접 재현·확인 — 두 번째 자녀 탭 선택 → 기록 열기 → 뒤로 나왔을 때 그 탭이 그대로 유지됨을 확인함("확인했어 오류가 해결됐어").

## 전 화면 태블릿/PC 반응형 대응 (2026-09-12)

사용자가 "모바일에서만 보이게 설계된 것 같은데 PC/패드에서도 쓰려면 얼마나 어려울까"라고 물어봄. 코드를 보니 전 화면이 `.app-shell`(고정 `max-width: 480px`) 클래스 하나로 통일돼 있어서 원인은 명확했다.

**1단계 — 부모 화면만 (사용자가 "부모용 화면 위주로 먼저 진행해줘"라고 응답):**
- `globals.css`에 별도의 `.app-shell-wide` 클래스를 신설(모바일은 `max-w-[480px]` 동일, `md:max-w-2xl`, `lg:max-w-5xl`로 단계적으로 넓어짐)하고, 기존 `.app-shell`은 그대로 둔 채 `/settings`, `/settings/stats`, `/settings/badges`, `/settings/children`, `/settings/coach`, `/settings/records` 6개 부모 전용 화면(`requireParentProfile`로 막힘)만 `.app-shell-wide`로 교체.
- 화면별 내용 배치도 폭에 맞게 조정: `/settings`는 메뉴 카드 `md:grid-cols-2`, `/settings/children`·`/settings/badges`는 자녀 카드 `lg:grid-cols-2`(카드 안 이모지 아바타가 8열로 촘촘해서 `md`가 아니라 `lg`부터 — `md`에서 2열로 쪼개면 오히려 원래 모바일 폭보다 좁아짐), `/settings/coach`는 반대로 `md:max-w-xl`로 폭을 제한(지침 문구를 읽고 고치는 화면이라 너무 넓으면 오히려 읽기 불편함), `/settings/stats`는 "기록 방식"·"독서로 반영 현황" 카드를 `md:grid-cols-2`로.
- `/settings/records`가 쓰는 `RecordsBrowser`는 자녀 본인 화면(`/records`)과 공유하는 컴포넌트라 새 `layout?: "list" | "grid"` prop(기본값 `"list"`)을 추가해 부모 화면(`ChildRecordsTabs`)에서만 `layout="grid"`를 넘기고, 검색창+날짜 필터도 `md:flex`로 한 줄 배치. 그리드 모드에서 `RecordCard`의 기본 `mb-3.5`가 `gap-3`와 겹쳐 행 간격만 벌어지는 건 `[&>*]:mb-0`으로 정리.
- **`BadgeGrid`는 건드리지 않음**: 처음엔 `sm:grid-cols-4`로 넓혀볼까 했으나, 이 컴포넌트가 자녀 홈(`/home`, "내 배지" 섹션)에서도 재사용되고 있어서 — 부모 화면만 넓히려던 변경이 자녀 화면에도 새어나갈 뻔한 걸 검토 중 발견하고 되돌렸다. **공유 컴포넌트를 수정할 때는 재사용처(특히 자녀 화면 vs 부모 화면)를 항상 먼저 확인할 것.**

**2단계 — 나머지 전체 화면 (사용자가 PC 브라우저로 1단계를 확인해보겠다며 "다른 화면도 계속 넓혀줘"라고 요청):**
- 로그인/회원가입, 프로필 선택/생성/PIN 입력, 자녀 홈, 대화(`ChatSession`)·감상문 검수(`ReviewSession`)·책 정보 입력(`NewBookForm`)·OCR 촬영/검수(`NewOcrForm`/`OcrReview`)·기록 방식 선택(`/read/new`)·기록 상세(`RecordDetail`)·자녀 본인 기록 목록(`/records`) 등 남은 모든 화면을 마저 넓혔다.
- 로그인/PIN처럼 원래 "가운데 정렬된 좁은 카드"가 자연스러운 화면은 셸은 넓히되 내용을 `mx-auto w-full max-w-sm`(또는 `max-w-md`/`max-w-xl`) 래퍼로 감싸 폭을 제한 — 넓은 화면에서 로그인 폼이나 채팅창, 감상문 텍스트가 끝까지 늘어지면 오히려 읽기/쓰기 불편하다는 원칙을 여기서도 그대로 적용(`/settings/coach`와 같은 논리). `ChatSession`/`ReviewSession`처럼 `flex-1`로 남은 세로 공간을 스크롤 영역이 차지해야 하는 화면은 래퍼 자체도 `flex flex-1 flex-col`로 만들어 세로 레이아웃이 깨지지 않게 함.
- `/records`(자녀 본인 기록)에도 이미 만들어둔 `RecordsBrowser`의 `layout="grid"`를 그대로 적용해 넓은 화면에서 여러 열로 보이게 함.
- `/profiles`(프로필 선택 — `requireParentProfile`로 막힌 부모 전용 화면) 카드 그리드를 `grid-cols-2` 고정에서 `sm:grid-cols-3 md:grid-cols-4`로, `/read/new`(기록 방식 선택) 두 카드를 `md:grid-cols-2`로.
- **결과적으로 앱의 모든 화면이 `.app-shell-wide`를 쓰게 되면서, 원래의 좁은 전용 `.app-shell`이 완전히 죽은 클래스가 됨** — `.app-shell`의 정의 자체를 `.app-shell-wide`의 반응형 규칙으로 바꾸고 `.app-shell-wide`는 삭제한 뒤, 모든 파일에서 `app-shell-wide` 클래스명을 다시 `app-shell`로 일괄 치환해 하나로 합쳤다. 화면별로 폭을 제한해야 하는 곳은 여전히 각 페이지 내부의 `mx-auto max-w-*` 래퍼가 담당한다.

## 글꼴을 프리텐다드(Pretendard)로 교체 (2026-09-12)

사용자 요청. 확인해보니 기존 `layout.tsx`의 Geist 폰트 로딩(`next/font/local`)이 CSS 변수(`--font-geist-sans`/`--font-geist-mono`)만 만들어두고 실제로는 `globals.css`의 `body` 규칙이나 `tailwind.config.ts`(`theme.fontFamily` 없음) 어디에서도 그 변수를 참조하지 않아서, **실제 화면에는 처음부터 Geist가 아니라 `globals.css`에 하드코딩된 시스템 폰트 스택**(`-apple-system, ..., "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`)이 렌더링되고 있었다(Next.js 기본 스캐폴딩이 남긴 죽은 설정으로 보임).

- 프리텐다드 가변 폰트(Variable, 전체 굵기 45~920 하나로 커버)를 `next/font/local`로 셀프 호스팅 — CDN `<link>` 대신 빌드에 포함시켜 외부 네트워크 요청 없이 서빙되고, Next.js가 자동으로 프리로드+layout shift 방지까지 처리한다. 파일은 jsdelivr(`cdn.jsdelivr.net/npm/pretendard@latest/...`)에서 받아 `src/app/fonts/PretendardVariable.woff2`로 저장(~2MB, 전체 한글 음절 커버라 가변 폰트치고는 큰 편이지만 이 프로젝트 성격상 통상적인 트레이드오프로 판단).
- `layout.tsx`: Geist 로딩 코드를 제거하고 `pretendard` 하나로 교체, `body`에 `pretendard.variable`만 적용.
- `globals.css`: `body`의 `font-family`를 `var(--font-pretendard)`를 최우선으로 하고 기존 시스템 폰트 스택은 폴백으로 남김(폰트 로드가 늦을 때 대비).
- 이제 진짜로 안 쓰는 `src/app/fonts/GeistVF.woff`/`GeistMonoVF.woff`는 삭제.

## AI 질문 스타일(/settings/coach) 다듬기 (2026-09-12)

사용자 요청 "AI 질문 스타일에 대해 세심하게 다듬어보자". 코드를 다시 훑어보고 부모가 실제로 이 화면을 쓸 때 겪을 만한 구멍 세 가지를 찾아 고쳤다 — 새 질문을 만들기보다 기존 기능의 완성도를 높이는 데 집중함.

1. **지침 문구를 써놓고도 결과를 확인할 방법이 없었다.** 부모는 자녀 프로필로 전환하지 않는 한 실제 대화 화면을 볼 수 없어서, `/settings/coach`에서 문구를 고쳐도 "이게 실제로 어떤 질문이 되어 나올지" 알 도리가 없었다. 단계별 텍스트 영역 아래에 **"🔍 이 지침으로 예시 질문 미리보기"** 버튼을 추가 — 저장 없이 지금 입력창 내용을 그대로 `generateNextQuestion`(실제 대화에서 쓰는 바로 그 함수)에 1회성으로 넘겨서 결과를 보여준다. 고정 예시 책("무지개 물고기", 저작권 있는 원문이 아니라 사실 관계만 담은 한두 문장 줄거리)과 미리 짜둔 가상 문답을 앞선 단계 맥락으로 깔아둬서, 2·3단계 미리보기도 자연스럽게 이어지도록 했다(`src/app/api/family/coach-settings/preview/route.ts` 신규, 부모 전용).
2. **글자 수 제한(서버에서 이미 500자로 막고 있었음)이 화면에는 전혀 안 보였다.** 저장을 눌러야만 "너무 길어요" 에러를 만날 수 있었던 것 — 텍스트 영역에 `maxLength={500}`과 실시간 글자 수 카운터를 추가해 애초에 넘길 수 없게 함.
3. **변경사항을 저장 안 하고 화면을 나가도 아무 경고가 없었다.** "저장하지 않은 변경사항이 있어요" 안내 문구를 추가하고, 변경사항이 없으면(`isDirty`가 false) "저장" 버튼 자체를 비활성화해 불필요한 재저장 클릭도 막음.

부수적으로, 프리셋과 저장된 지침이 정확히 일치하면(공백 트리밍 기준) 화면을 새로 열었을 때도 그 프리셋 카드가 "적용됨"으로 표시되도록 했다(`matchingPresetId`, `src/components/CoachSettingsForm.tsx`에서 export하고 유닛 테스트 4개 추가 — `toIlikePattern`처럼 "use client" 컴포넌트 파일에서 순수 함수만 export해 테스트하는 기존 패턴을 그대로 따름) — 예전엔 페이지를 새로 열 때마다 `loadedPreset`이 항상 `null`로 리셋돼서, 방금까지 프리셋을 쓰고 있었어도 그 사실을 알 수 없었다.

## AI 질문 스타일 화면에 "항상 4개는 아니다" 안내 추가 (2026-09-12)

사용자 피드백: "질문에 무조건 4단계를 유지하는 건 아니라고 했었는데, AI 질문 스타일에는 그 내용이 알 수가 없어." 8a52d0e 커밋(팔로업 질문 추가)에서 실제 대화 로직은 바뀌었지만, `/settings/coach` 화면의 설명 문구는 여전히 "각 단계에서 참고하는 지침"이라고만 되어 있어서 부모가 지침을 고칠 때 팔로업의 존재를 알 방법이 없었다 — 코드는 이미 아는데 화면 문구가 안 따라간 전형적인 문서-구현 불일치 사례.

- `/settings/coach` 페이지에 안내 박스 추가: "질문은 보통 1단계 2개 → 2단계 1개 → 3단계 1개, 총 4개로 진행되지만, 아이 답변이 너무 짧으면 같은 단계에서 한 번 더 캐물을 수 있어 실제 질문 수는 4개보다 많아질 수 있다"는 것과, "그 팔로업 질문의 말투는 고정돼 있어 이 화면의 지침으로는 못 바꾼다"는 것(팔로업 문구는 `azureOpenAI.ts`에 하드코딩돼 있음, `readingSession.ts`의 `isAnswerTooShort`/`MAX_FOLLOW_UPS_PER_STAGE` 참고)을 명시.
- `CoachSettingsForm`의 각 단계 라벨에 "질문 N개"를 추가(`STAGE_PLAN`에서 계산, `1단계 · 장면 소환 · 질문 2개`처럼 표시), 3단계에는 "· 마지막"도 붙임.

## 앱 공식 명칭 '리딩버디' 확정 및 PWA 아이콘/브랜딩 적용 (2026-09-13)

사용자 요청: "repository를 읽고 개발 내역을 파악해줘. 앱을 나타내는 앱의 이름과 아이콘을 디자인하자".
코드베이스 분석 후 4가지 네이밍 방향과 3가지 아이콘 디자인 시안(A. 펼쳐진 책+말풍선 / B. 헤드폰 책 마스코트 / C. 쌍둥이 북 & 북마크)을 제안했고, 아이콘은 시안 A가 채택됨. 초기에 '도란도란'을 시도했으나 기존에 이미 존재하는 앱명임이 확인되어, 원래의 가칭이자 서비스 정체성을 직관적으로 나타내는 **'리딩버디 (Reading Buddy)'**를 공식 명칭으로 최종 확정함.

- **앱 명칭 확정**: **'리딩버디 (Reading Buddy)'**로 최종 확정.
- **PWA 아이콘 및 파비콘 생성**:
  - 선택된 시안 A(크림색 배경, 따뜻한 양장본 책 위에 세이지 그린과 소프트 블루의 미소 짓는 두 말풍선)를 기반으로 고해상도 에셋 세트 생성.
  - `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png` (PWA 표준)
  - `public/icons/icon-maskable-192x192.png`, `public/icons/icon-maskable-512x512.png` (안드로이드 적응형 안전영역 마스커블 아이콘)
  - `public/apple-touch-icon.png`, `public/icons/apple-touch-icon.png` (iOS 홈 화면)
  - `public/favicon.ico`, `public/favicon-16x16.png`, `public/favicon-32x32.png` (브라우저 파비콘)
- **메타데이터 및 PWA 설정**:
  - `public/manifest.json`: 앱 이름 `리딩버디`, 설명 `대화와 사진으로 남기는 우리 아이 독서 기록`, 아이콘 목록 갱신.
  - `src/app/layout.tsx`: `metadata.title`을 `리딩버디 - 대화로 남기는 독서 기록`으로 설정, 파비콘/터치아이콘 링크 설정.
- **로그인 화면 브랜드 UI 반영**:
  - `src/app/login/page.tsx`: 기존 단순 텍스트 이모지(`📚`) 대신 Next.js `<Image />` 컴포넌트로 공식 책&말풍선 로고 아이콘과 브랜드명 `리딩버디`를 깔끔하게 배치.
- **배포 및 검증**:
  - 로컬 프로덕션 빌드(`npm run build`) 30개 정적/동적 라우트 검증 완료.
  - GitHub push → Vercel 자동 배포 완료 (`https://reading-buddy-ten.vercel.app/login`에서 200 OK 및 리딩버디 타이틀/공식 로고 노출 확인).

## 독서 통계: 모바일에서 추이 그래프가 카드 밖으로 넘치던 버그 수정 (2026-09-13)

사용자 피드백: "모바일에서 봤을 때 독서량 추이 그래프가 밖으로 빠져나와." `/settings/stats`의 "최근 6개월 독서량 추이" 막대그래프에서 자녀별 막대 폭이 `w-3`(12px) 고정이었던 게 원인 — 자녀가 3명 이상이면 6개월 × 자녀 수만큼의 막대 폭 합이 카드 폭보다 넓어져 좁은 화면에서 오른쪽으로 넘쳤다. 월별 컬럼이 `flex-1`이면서 `min-w-0`이 없었던 것도 겹쳐서(플렉스 아이템 기본값은 내용물 크기 밑으로 줄어들지 않음) 컬럼 자체가 찌그러지지 못하고 그대로 밀려났다.

- 막대 폭을 자녀 수에 따라 동적으로 줄임(`barWidthPx`: 1~2명 12px, 3명 9px, 4명 이상 7px) — 6개월 × 자녀 수 막대 합이 항상 카드 폭 안에 들어오도록.
- 월별 컬럼에 `min-w-0` 추가(플렉스 아이템이 내용물 크기 밑으로도 줄어들 수 있게 하는 표준 수정).
- 혹시 이후 자녀가 더 늘어나 그래도 안 맞는 경우를 대비해 차트 영역을 `overflow-x-auto`로 감싸 — 넘치면 페이지 전체가 아니라 차트 안에서만 가로 스크롤되게 안전장치를 둠.

## 모바일 오버플로우 전수 점검 (2026-09-13)

사용자 요청: "다른 화면도 모바일에서 넘치는 곳 없는지 확인해줘" — 방금 고친 독서 통계 그래프와 같은 종류의 버그(flex 아이템이 고유 최소 크기 밑으로 안 줄어들어 좁은 화면에서 밀려나는 문제)가 다른 화면에도 있는지 코드 전체를 훑었다.

**추가로 찾아 고친 것 2건** — 둘 다 `<input>`/`<textarea>`가 고정폭 형제 요소와 같은 flex 행에 있는데 `min-w-0`이 없어서, input/textarea의 브라우저 기본 최소 폭(내용과 무관하게 일정 폭을 차지하려는 성질)이 아주 좁은 화면에서 옆의 고정폭 요소와 합쳐 넘칠 수 있었던 경우:
- `ChatSession.tsx`(대화 입력창): 답변 textarea + 마이크 버튼(48px 고정) + 보내기 버튼. textarea에 `min-w-0` 추가.
- `ChildEditCard.tsx`(자녀 이름 수정): 아바타 버튼(고정폭) + 이름 input. input에 `min-w-0` 추가.
- `RecordsBrowser.tsx`(기록 검색 날짜 필터): 네이티브 `<input type="date">` 두 개가 나란히 있는데 달력 UI 자체의 최소 폭 때문에 320px대 폰에서 빠듯할 수 있어서, 둘 다 `min-w-0 flex-1`로 폭을 균등하게 나눠 갖고 필요하면 줄어들 수 있게 함.

**확인했지만 손대지 않은 것들(안전하다고 판단한 이유)**:
- 대부분의 `grid-cols-N` 레이아웃(`ChildEditCard`의 이모지 8열, `PinKeypad`/`BadgeGrid`의 3열, `profiles`의 자녀 카드 그리드 등)은 Tailwind 그리드가 기본적으로 `minmax(0, 1fr)`을 쓰기 때문에 flex와 달리 애초에 이 문제가 없다 — 좁아지면 셀이 작아질 뿐 페이지 밖으로 밀려나지 않는다.
- 책 제목/자녀 이름처럼 사용자 입력 텍스트가 들어가는 자리들(`RecordCard`, `RecordDetail`, `home` 헤더 등)은 대부분 한글이라 `white-space: nowrap`이 걸려있지 않은 한 좁은 곳에서 자동으로 줄바꿈되고 옆으로 새지 않는다 — `nowrap`이 걸린 자리(`settings/stats`의 자녀 이름/이번 달 권수)는 이미 `auto-fit` 그리드 카드 안에 있어서 카드 자체가 줄어들 뿐 페이지가 넘치지는 않는다.
- 가로 스크롤이 의도된 자리(`ChildRecordsTabs`의 자녀 탭 목록, 방금 고친 통계 그래프)는 이미 `overflow-x-auto`로 감싸둬서, 내용이 넘쳐도 그 영역 안에서만 스크롤되고 페이지 전체가 밀리지 않는다.

## ISBN 캡처 추가 — 생기부 연계 검토 결과 (2026-09-13)

사용자가 이 앱을 만든 배경을 다시 설명함: "독서로와 생기부 연계가 되면서 독서로 기록이 중요해지면서 이 앱을 개발하게 되었어." 함께 공유받은 자료 핵심: 교육부가 '독서로' 기록을 나이스(NEIS)와 연동해 생기부에 자동 기재하는 방안을 추진 중이고, **독서활동상황란에는 "ISBN에 등재된 도서에 한해" 책 제목/저자를 학기 단위로 입력할 수 있다**(대입에 직접 반영되진 않지만 세특·창의적 체험활동에 녹여낼 수 있어 중요). 이 조건에 비춰 코드를 다시 훑어서 개발이 더 필요한 부분을 찾음.

**찾은 것: ISBN을 전혀 캡처하지 않고 있었다.** 카카오/도서관정보나루/네이버 도서 검색 API 셋 다 응답에 ISBN을 이미 포함하고 있는데(각각 `isbn`, `isbn13`, `isbn` 필드), `BookCandidate` 타입에 그 필드를 아예 안 받고 있어서 버려지고 있었다 — 새 API 연동 없이 파싱만 추가하면 되는 상황이라 바로 구현함(0010 페이지 수 추가와 정확히 같은 패턴):

- `src/lib/isbn.ts` 신규: `pickIsbnFromApiField`(카카오/네이버가 "ISBN10 ISBN13"처럼 공백으로 섞어 주는 값에서 13자리를 우선 추출), `normalizeIsbnInput`(부모가 직접 입력한 값의 하이픈 정리 + 10/13자리 형식 검증, 체크섬까지는 안 봄). 유닛 테스트 8개.
- `conversation_sessions.book_isbn`/`reading_records.isbn`(`0011_book_isbn.sql`) 추가 — 대화 시작 시 담아뒀다가 감상문 저장 시 복사되는 흐름도 페이지 수와 동일.
- `NewBookForm.tsx`: 검색 후보를 고르면 자동으로 ISBN이 채워지고(찾았으면 "✅ ISBN 확인됨" 안내), 그 후 제목을 손으로 고치면 엉뚱한 책에 ISBN이 붙지 않도록 비운다. 직접 타이핑만 한 경우는 ISBN 없이 진행 가능(강제하지 않음 — 대부분의 책은 검색으로 찾아지고, 못 찾은 소수 사례까지 막으면 기록 자체를 못 남기게 됨).
- `RecordDetail.tsx`: ISBN 필드를 페이지 수와 똑같은 패턴으로 추가(선택 입력, 비어 있어도 저장 가능, 값이 있으면 형식 검증, 네이버쇼핑 "찾아보기" 링크, "독서로 등록하기" 복사 텍스트에 포함) — 자동으로 못 채운 기록(직접 입력·OCR)도 부모가 나중에 채워 넣을 수 있다.
- OCR 검수 화면(`OcrReview.tsx`)에는 굳이 추가하지 않음 — 종이 독서노트에서 ISBN을 읽어낼 방법이 없고, 어차피 `RecordDetail`에서 사후에 채울 수 있어 중복 UI가 불필요하다고 판단.

**검토했지만 지금 당장 개발하지 않기로 한 것들**:
- **'독서로' 완전 자동화(Playwright) 재검토**: 생기부 연계로 중요도가 올라간 건 맞지만, 부모의 실제 로그인 자격증명을 다루고 정부 플랫폼에 자동으로 값을 쓰는 작업이라 여전히 이용약관 확인이 먼저 필요하다고 판단 — 임의로 만들지 않음. **사용자가 재검토를 원하면 별도로 알려달라고 요청할 것.**
- **학기 단위 필터/내보내기**: "학기 단위로 입력"이라는 조건이 있지만, 기존 기록 검색 화면(`/records`, `/settings/records`)에 이미 날짜 범위 필터가 있어서 학기 구간(3~8월/9~2월)을 그걸로 걸러볼 수 있다 — 별도 "학기" 개념을 새로 만들 만큼 아쉬운 지점은 아니라고 판단, 필요해지면 나중에.
- **감상문을 세특/창의적 체험활동용으로 더 길게/다른 형식으로 뽑는 기능**: 현재 3단 구성 감상문이 이미 "독서로에 등록"용으로 잘 맞게 설계돼 있고, 세특 활용은 결국 담임 교사·학생이 직접 재구성하는 영역이라 앱이 대신 써주는 건 범위 밖으로 판단 — 사용자가 명시적으로 원하면 재검토.

## 참고 문서

- [docs/PRD.md](docs/PRD.md) — 전체 PRD (v1.9)
- [docs/BRIEF.md](docs/BRIEF.md) — 프로젝트 브리프(5분 요약)
- [docs/STORIES.md](docs/STORIES.md) — 기능 단위 사용자 스토리(전부 구현 완료 상태)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 실제 구현 기준 기술 아키텍처(PRD 6장의 계획과 다른 부분 포함)
- `twin_choice/CLAUDE.md` — 자매 앱의 인증/RLS 패턴 원본 (같은 머신의 형제 저장소)
