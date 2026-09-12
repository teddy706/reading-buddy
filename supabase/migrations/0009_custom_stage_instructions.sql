-- 부모가 AI의 단계별 질문 지침(장면 소환/역할 바꾸기/현실 적용)을 가족 단위로 직접 수정할 수
-- 있게 한다 — 매번 같은 질문 패턴이 반복되면 아이가 지루해할 수 있다는 피드백에 따른 추가.
-- {"1": "...", "2": "...", "3": "..."} 형태의 jsonb. null이거나 특정 단계 키가 없으면
-- src/lib/readingSession.ts의 DEFAULT_STAGE_INSTRUCTIONS로 폴백한다(resolveStageInstruction).
--
-- families 테이블은 원래 select 정책만 있고 쓰기는 전부 서버(service role)에서만 하므로
-- (0003_rls.sql 참고), 이 컬럼도 같은 규칙을 따른다 — 새 RLS 정책은 필요 없다.
-- 조회는 기존 families_select 정책 그대로: 같은 가족이면 부모/자녀 모두 읽을 수 있어야
-- 자녀의 대화 세션(next-question 라우트)도 이 값을 반영해 질문을 만들 수 있다.

alter table families add column if not exists custom_stage_instructions jsonb;
