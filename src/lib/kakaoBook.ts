import "server-only";

interface KakaoBookDocument {
  title: string;
  authors: string[];
  contents: string;
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
