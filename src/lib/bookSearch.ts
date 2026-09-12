import "server-only";
import { searchBooks, type BookCandidate } from "@/lib/kakaoBook";
import { searchNaverBooks } from "@/lib/naverBook";

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

// 책 후보 검색(제목 자동완성, 표지 촬영 인식)이 공통으로 쓰는 진입점. 카카오와 네이버를
// 동시에 조회해서 합친다 — 그림책/동화책처럼 한쪽 출처에만 있는 책도 놓치지 않기 위함.
// 둘 중 하나가 설정 안 돼 있거나(NAVER_CLIENT_ID/SECRET 미설정) 실패해도 나머지 한쪽
// 결과만으로 조용히 계속 동작한다(각 lib의 폴백 원칙을 그대로 물려받음).
export async function searchBooksMultiSource(query: string, size = 5): Promise<BookCandidate[]> {
  if (!query.trim()) return [];

  const [kakaoResults, naverResults] = await Promise.all([
    searchBooks(query, size),
    searchNaverBooks(query, size),
  ]);

  return dedupeCandidates([...kakaoResults, ...naverResults]).slice(0, size);
}
