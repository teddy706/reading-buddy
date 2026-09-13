import "server-only";
import { pickIsbnFromApiField } from "@/lib/isbn";

interface KakaoBookDocument {
  title: string;
  authors: string[];
  contents: string;
  thumbnail?: string;
  isbn?: string;
}

export interface BookCandidate {
  title: string;
  author: string | null;
  thumbnail: string | null;
  description: string | null;
  // ISBN-13(없으면 ISBN-10) — 생기부 독서활동 등재·'독서로' 등록에 쓰인다(pickIsbnFromApiField
  // 참고). 검색 API가 그대로 내려주는 값이라 별도 조회 없이 채워진다.
  isbn: string | null;
}

// 책 제목으로 줄거리 요약을 가져와 질문 생성 프롬프트의 컨텍스트로 쓴다(PRD 6.4) — AI 내장
// 웹검색 대신 무료 API로 조회해서 AI 토큰 비용에 영향을 주지 않는다. 조회 실패/결과 없음은
// 흔한 상황(신간, 절판, 오탈자)이라 에러를 던지지 않고 null만 반환해서 호출부가 조용히
// 폴백(제목/저자만으로 질문 생성)하게 한다.
export async function fetchBookContext(title: string, author: string | null): Promise<string | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;

  try {
    const params = new URLSearchParams({ query: title, size: "3" });
    const response = await fetch(`https://dapi.kakao.com/v3/search/book?${params}`, {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { documents?: KakaoBookDocument[] };
    const documents = data.documents ?? [];
    if (documents.length === 0) return null;

    const best =
      (author && documents.find((d) => d.authors.some((a) => a.includes(author) || author.includes(a)))) ||
      documents[0];

    return best.contents?.trim().slice(0, 600) || null;
  } catch {
    return null;
  }
}

// 표지 촬영 자동 인식(Phase 2 C)에서 쓴다. OCR+AI로 뽑아낸 제목 추정치는 오탈자가 섞일 수
// 있어서 하나로 단정하지 않고, 후보 몇 개를 돌려줘 아이/부모가 직접 골라 확정하게 한다.
export async function searchBooks(query: string, size = 5): Promise<BookCandidate[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key || !query.trim()) return [];

  try {
    const params = new URLSearchParams({ query: query.trim(), size: String(size) });
    const response = await fetch(`https://dapi.kakao.com/v3/search/book?${params}`, {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { documents?: KakaoBookDocument[] };
    return (data.documents ?? []).map((d) => ({
      title: d.title,
      author: d.authors?.[0] ?? null,
      thumbnail: d.thumbnail || null,
      description: d.contents?.trim().slice(0, 200) || null,
      isbn: pickIsbnFromApiField(d.isbn),
    }));
  } catch {
    return [];
  }
}
