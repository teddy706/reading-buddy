-- 교육부 지침상 학교생활기록부(생기부) 독서활동상황란은 "ISBN에 등재된 도서에 한해"
-- 책 제목/저자를 학기 단위로 기재할 수 있다 — '독서로' 등록 시 정확한 판본을 특정하는 데도
-- ISBN이 쓰인다(사용자: "독서로와 생기부 연계가 되면서 독서로 기록이 중요해지면서 이 앱을
-- 개발하게 되었어"). 카카오/도서관정보나루/네이버 도서 검색 API 모두 검색 응답에 ISBN을
-- 이미 포함하고 있어서 새 API 연동 없이 필드만 추가한다 — 0010_page_count.sql과 동일한
-- 패턴(대화 시작 시 conversation_sessions에 먼저 담아두고, 감상문 저장 시 reading_records로
-- 복사). 자동완성/표지 인식으로 고른 경우에만 자동으로 채워지고, 직접 타이핑했거나 OCR로
-- 만든 기록은 비어있을 수 있어 기록 상세 화면에서 부모가 나중에 채워 넣을 수 있다.
alter table conversation_sessions add column if not exists book_isbn text;
alter table reading_records add column if not exists isbn text;
