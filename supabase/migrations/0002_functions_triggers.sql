-- 헬퍼 함수: 현재 로그인한 auth.uid() 를 profiles 로 매핑한다.
-- security definer + search_path 고정으로, RLS 정책 안에서 profiles 를 다시 조회할 때
-- 무한 재귀(RLS가 RLS를 부르는 상황)를 피한다. Supabase 공식 권장 패턴(twin_choice와 동일).

create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where user_id = auth.uid() limit 1
$$;

-- reading_records.updated_at 자동 갱신.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reading_records_set_updated_at
before update on reading_records
for each row execute function public.set_updated_at();

create trigger dokseoro_credentials_set_updated_at
before update on dokseoro_credentials
for each row execute function public.set_updated_at();
