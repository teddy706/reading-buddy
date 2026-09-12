import "server-only";
import { searchBooks, type BookCandidate } from "@/lib/kakaoBook";
import { searchNaverBooks } from "@/lib/naverBook";
import { searchLibraryBooks } from "@/lib/libraryBook";

export function dedupeCandidates(candidates: BookCandidate[]): BookCandidate[] {
  const seen = new Set<string>();
  const deduped: BookCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.title.trim()}|${(candidate.author ?? "").trim()}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

// 책 후보 검색(제목 자동완성, 표지 촬영 인식)이 공통으로 쓰는 진입점. 카카오/네이버/도서관정보나루를
// 동시에 조회해서 합친다 — 그림책/동화책처럼 한쪽 출처에만 있는 책도 놓치지 않기 위함.
// 출처 중 일부가 설정 안 돼 있거나(각 lib의 API 키 미설정) 실패해도 나머지 결과만으로
// 조용히 계속 동작한다(각 lib의 폴백 원칙을 그대로 물려받음).
export async function searchBooksMultiSource(query: string, size = 5): Promise<BookCandidate[]> {
  if (!query.trim()) return [];

  const [kakaoResults, naverResults, libraryResults] = await Promise.all([
    searchBooks(query, size),
    searchNaverBooks(query, size),
    searchLibraryBooks(query, size),
  ]);

  return dedupeCandidates([...kakaoResults, ...naverResults, ...libraryResults]).slice(0, size);
}
