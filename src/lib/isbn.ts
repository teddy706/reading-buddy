// ISBN 관련 순수 로직. 교육부 지침상 학교생활기록부(생기부) 독서활동상황란은 "ISBN에
// 등재된 도서에 한해" 책 제목/저자를 학기 단위로 기재할 수 있다 — '독서로' 등록 시에도
// 정확한 책(판본)을 특정하는 데 ISBN이 쓰인다. 카카오/도서관정보나루/네이버 도서 검색
// API 모두 검색 결과에 ISBN을 이미 포함하고 있어서, 새 API 연동 없이 파싱만 추가하면 된다.

// 카카오/네이버 도서 검색 API의 isbn 필드는 "8983920775 9788983920770"처럼 ISBN-10과
// ISBN-13을 공백으로 이어붙여 돌려준다(순서가 항상 같지는 않아 길이로 구분한다). 생기부/
// 독서로 등록에는 13자리가 표준이라 있으면 13자리를 우선한다.
export function pickIsbnFromApiField(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(/[^0-9Xx]/g, ""))
    .filter(Boolean);
  const isbn13 = tokens.find((t) => t.length === 13);
  const isbn10 = tokens.find((t) => t.length === 10);
  return isbn13 ?? isbn10 ?? null;
}

// 부모가 기록 상세 화면에서 직접 입력/수정하는 ISBN(하이픈·공백이 섞여 있을 수 있음)을
// 정리한다. 10자리(마지막 검증 문자로 X 허용) 또는 13자리 숫자가 아니면 null(형식 오류)을
// 돌려준다 — 실제로 유효한 ISBN인지(체크섬 등)까지는 검증하지 않고 자릿수만 확인한다.
export function normalizeIsbnInput(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (cleaned.length === 10 || cleaned.length === 13) return cleaned;
  return null;
}
