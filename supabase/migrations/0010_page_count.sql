-- 책의 페이지 수를 기록한다(사용자 요청: "책의 페이지 수가 기록되어야해"). 카카오/도서관정보나루
-- 도서 검색 API 둘 다 페이지 수를 제공하지 않아서(서지정보/줄거리 위주), 자동 조회가 아니라
-- 대화 시작 화면(NewBookForm)·독서노트 OCR 검수 화면(OcrReview)에서 사람이 직접 입력한다.
--
-- reading_records.page_count가 최종 값이다. 대화 기반 기록은 conversation_sessions.book_page_count에
-- 먼저 저장해두고(책 제목/저자와 같은 패턴), 감상문 저장 시점(reading-sessions/[id]/finish)에
-- reading_records로 복사한다. 기존 기록에는 값이 없으므로 둘 다 nullable — 자녀/부모가
-- 기록 상세 화면(RecordDetail)에서 나중에 채워 넣을 수 있다.
alter table conversation_sessions add column if not exists book_page_count integer check (book_page_count > 0);
alter table reading_records add column if not exists page_count integer check (page_count > 0);
