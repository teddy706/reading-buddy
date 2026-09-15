-- 데모 체험 계정 여부. true인 가족은 회원가입 화면의 "데모 체험하기" 링크로 로그인하는
-- 읽기 전용 체험 계정 — 관련 API 라우트가 실제 쓰기 작업을 막는 데 쓴다(src/lib/demoMode.ts).
alter table families add column is_demo boolean not null default false;
