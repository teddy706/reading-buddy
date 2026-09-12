import "server-only";
import type { BookCandidate } from "@/lib/kakaoBook";

interface NaverBookItem {
  title: string;
  author: string;
  description: string;
  image: string;
}

// 네이버 검색 결과는 일치한 부분에 <b> 태그를 감싸서 돌려준다 — 화면에 그대로 보여줄 거라 걷어낸다.
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

// 네이버는 저자가 여러 명이면 "지은이1^지은이2" 처럼 캐럿(^)으로 이어붙여서 돌려준다.
function firstAuthor(author: string): string | null {
  const cleaned = stripHtml(author).split("^")[0]?.trim();
  return cleaned || null;
}

// 카카오 도서 검색만으로는 그림책/동화책이 잘 안 걸리는 경우가 많다는 피드백에 따라 추가한
// 두 번째 출처. searchBooks(카카오)와 같은 BookCandidate 형태로 돌려줘서 호출부가 두 출처를
// 그대로 합칠 수 있게 한다(src/lib/bookSearch.ts 참고). 카카오와 마찬가지로 키가 없거나
// 실패해도 에러를 던지지 않고 빈 배열만 돌려줘서 호출부가 조용히 폴백하게 한다.
export async function searchNaverBooks(query: string, size = 5): Promise<BookCandidate[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret || !query.trim()) return [];

  try {
    const params = new URLSearchParams({ query: query.trim(), display: String(size) });
    const response = await fetch(`https://openapi.naver.com/v1/search/book.json?${params}`, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { items?: NaverBookItem[] };
    return (data.items ?? []).map((item) => ({
      title: stripHtml(item.title),
      author: item.author ? firstAuthor(item.author) : null,
      thumbnail: item.image || null,
      description: item.description ? stripHtml(item.description).slice(0, 200) : null,
    }));
  } catch {
    return [];
  }
}
