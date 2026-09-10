-- 리딩버디 — Phase 1 스키마
-- 모든 테이블은 family_id (또는 family_id로 조인 가능한 부모 테이블)를 갖는다.
-- "가족은 하나뿐" 가정을 코드에 심지 않기 위해 family_id 기반으로 전부 스코프한다.
--
-- families/profiles 구조는 twin_choice(같은 쌍둥이 자녀 대상 자매 앱) 프로젝트와 의도적으로
-- 동일하게 맞췄다 — PRD 4.1의 멀티 앱 확장 전략에 따라, 향후 같은 Supabase 프로젝트/스키마를
-- 재사용할 수 있는 여지를 남겨두기 위함.

create extension if not exists "pgcrypto";

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 가족',
  -- 자녀 로그인 화면에서 "어느 가족인지" 특정하기 위한 짧은 코드(이메일이 없으므로 필요).
  -- 부모 회원가입 시 서버에서 발급한다.
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- profiles.user_id 는 auth.users 로 매핑된다. 부모/자녀 모두 실제 Supabase Auth 세션을 가지며
-- (자녀는 PIN으로 로그인하지만 내부적으로는 synthetic email/password 기반 세션을 발급받는다),
-- 그 결과 RLS 정책에서 auth.uid() 를 그대로 사용할 수 있다.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  name text not null,
  avatar text not null default '🧒',
  pin_hash text,
  created_at timestamptz not null default now()
);
create index profiles_family_id_idx on profiles(family_id);

-- 대화 기반 기록의 원본 대화 로그. 완료되면 reading_records 로 최종 감상문이 만들어진다.
create table conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_profile_id uuid not null references profiles(id) on delete cascade,
  book_title text not null,
  book_author text,
  -- [{ role: 'assistant' | 'child', content: string, created_at: string }, ...]
  messages jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now()
);
create index conversation_sessions_family_id_idx on conversation_sessions(family_id);
create index conversation_sessions_child_profile_id_idx on conversation_sessions(child_profile_id);

-- 학교 독서노트 사진 원본 및 OCR 결과.
create table ocr_uploads (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_profile_id uuid not null references profiles(id) on delete cascade,
  -- Supabase Storage 'reading-notes' 버킷 내 경로. 0004_storage.sql 참고.
  image_path text not null,
  raw_text text,
  parsed_result jsonb,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now()
);
create index ocr_uploads_family_id_idx on ocr_uploads(family_id);

-- 최종 독서 기록. '독서로' 반영 상태 포함.
create table reading_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_profile_id uuid not null references profiles(id) on delete cascade,
  book_title text not null,
  book_author text,
  source_type text not null check (source_type in ('conversation', 'ocr', 'manual')),
  content text not null,
  -- source_type에 따라 conversation_sessions.id 또는 ocr_uploads.id를 가리킨다(다형 참조라 FK 제약은 걸지 않음).
  source_ref_id uuid,
  recorded_at date not null default current_date,
  dokseoro_status text not null default 'pending' check (dokseoro_status in ('pending', 'synced', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reading_records_family_id_idx on reading_records(family_id);
create index reading_records_child_profile_id_idx on reading_records(child_profile_id);

-- '독서로'(read365.edunet.net) 로그인 정보. 서버(service role)에서만 접근, 클라이언트 RLS로는 완전 차단.
-- 9.7 조사 결과: 에듀넷 자체 계정 외에 SNS(네이버/구글/카카오) 간편 로그인도 지원하므로
-- login_type으로 구분한다 — SNS 로그인 계정은 현재 자동화 대상 밖(수동 등록 가이드로 폴백).
create table dokseoro_credentials (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references families(id) on delete cascade,
  login_type text not null default 'edunet' check (login_type in ('edunet', 'naver', 'google', 'kakao')),
  encrypted_username text,
  encrypted_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
