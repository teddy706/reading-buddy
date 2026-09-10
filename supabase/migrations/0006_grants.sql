-- 프로젝트 생성 시 "Automatically expose new tables"를 의도적으로 꺼뒀는데(부주의한 노출 방지 목적),
-- 이 옵션이 anon/authenticated의 노출뿐 아니라 service_role을 포함한 모든 역할의 기본 테이블
-- GRANT 자체를 스킵한다는 걸 뒤늦게 확인했다 (RLS와는 별개 계층 — GRANT가 없으면 BYPASSRLS인
-- service_role도 "permission denied for table ..." 를 받는다).
--
-- 실제 접근 제어는 여전히 RLS(0003_rls.sql)가 전담한다 — 이 GRANT는 "테이블을 만질 수 있는가"의
-- 최소 자격만 열어주는 조악한 문(coarse gate)이고, dokseoro_credentials처럼 정책이 0개인 테이블은
-- anon/authenticated에 GRANT를 줘도 RLS가 모든 행을 막아 여전히 접근 불가능하다.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- 앞으로 추가되는 테이블(Phase 2+ 마이그레이션)에도 자동으로 같은 GRANT가 적용되게 한다.
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
