-- 자녀 PIN 5회 연속 실패 시 1분 잠금 (PRD 3.1 확정 정책).
-- 클라이언트가 아직 인증되지 않은 상태(자녀 세션 전환 전)에서 검사해야 하므로
-- 이 값들은 서버(service role)에서만 읽고 쓴다 — profiles 테이블 자체에는
-- 이 두 컬럼에 대한 클라이언트 RLS 정책을 별도로 열지 않는다(기존 select 정책은 그대로 유지).

alter table profiles
  add column pin_fail_count int not null default 0,
  add column pin_locked_until timestamptz;
