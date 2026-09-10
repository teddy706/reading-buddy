-- RLS 정책
--
-- 설계 원칙(twin_choice와 동일):
-- * "프로비저닝"(가족 생성, 부모/자녀 계정 생성, '독서로' 자격증명 저장/조회, 자녀 데이터 삭제)은
--   전부 서버(app/api/**)에서 SUPABASE_SERVICE_ROLE_KEY 로 실행하며 RLS를 우회한다.
--   이 키는 절대 브라우저로 내려가지 않는다.
-- * 앱 런타임 동작(기록 조회/작성 등)은 브라우저가 로그인 세션(anon key)으로 직접 Supabase를
--   호출하며, 아래 RLS 정책이 유일한 방어선이다.
-- * 9.1(PRD)에서 지적한 대로 자녀 PIN 자체는 보안 경계가 아니지만, 자녀도 synthetic 계정으로
--   실제 auth.uid() 를 갖기 때문에 아래 정책은 "같은 가족인가"뿐 아니라 "본인 프로필인가"까지
--   DB 레벨에서 강제할 수 있다.

alter table families enable row level security;
alter table profiles enable row level security;
alter table conversation_sessions enable row level security;
alter table ocr_uploads enable row level security;
alter table reading_records enable row level security;
alter table dokseoro_credentials enable row level security;

-- families: 내 가족 row만 조회
create policy families_select on families
  for select using (id = public.my_family_id());

-- profiles: 같은 가족 구성원만 조회. 쓰기는 서버(service role)에서만.
create policy profiles_select on profiles
  for select using (family_id = public.my_family_id());

-- conversation_sessions: 부모는 두 자녀 것 모두, 자녀는 본인 것만.
create policy conversation_sessions_select on conversation_sessions
  for select using (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

create policy conversation_sessions_insert on conversation_sessions
  for insert with check (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

create policy conversation_sessions_update on conversation_sessions
  for update using (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

-- ocr_uploads: 위와 동일한 규칙.
create policy ocr_uploads_select on ocr_uploads
  for select using (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

create policy ocr_uploads_insert on ocr_uploads
  for insert with check (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

create policy ocr_uploads_update on ocr_uploads
  for update using (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

-- reading_records: 부모는 두 자녀 기록을 조회/검토/수정, 자녀는 본인 기록만 조회/작성/수정.
create policy reading_records_select on reading_records
  for select using (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

create policy reading_records_insert on reading_records
  for insert with check (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

create policy reading_records_update on reading_records
  for update using (
    family_id = public.my_family_id()
    and (public.my_role() = 'parent' or child_profile_id = public.my_profile_id())
  );

-- dokseoro_credentials: 클라이언트 role에는 정책을 하나도 두지 않는다 → 기본 거부(전체 차단).
-- Supabase Edge Function(service role)에서만 읽어 '독서로' 자동화 로직에 사용한다.
