-- dokseoro_credentials는 Phase 1 "4. 독서로 자동 연동"이 (이용약관 확인 전까지) 자동 로그인
-- 자격증명을 저장하지 않는 "수동 등록 가이드" 버전으로 확정되면서 src/ 어디에서도 참조되지
-- 않는 죽은 테이블로 남아 있었다 — 정리 차원에서 제거한다.
-- 테이블을 drop하면 여기 걸려 있던 트리거(dokseoro_credentials_set_updated_at, 0002)와
-- RLS 정책(0003, 애초에 0개였음)도 함께 사라진다. 자동 연동을 다시 만들게 되면 그때
-- 실제 필요한 컬럼(로그인 방식 등)을 다시 설계해서 새 마이그레이션으로 추가할 것.

drop table if exists dokseoro_credentials;
