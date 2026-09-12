import "server-only";
import type { BookCandidate } from "@/lib/kakaoBook";

interface LibraryBookDoc {
  bookname: string;
  authors: string;
  publisher: string;
  bookImageURL?: string;
}

// data4library의 authors 필드는 "지은이 지음ㅣ옮긴이 옮김"처럼 역할 표기와 여러 사람이
// 세로줄(|)/쉼표로 섞여 들어온다. 첫 번째 이름만 뽑고 "지음/글/그림/저" 같은 흔한 역할
// 표기를 정리한다 — 완벽한 파싱은 아니지만 후보 목록에 보여주는 용도로는 충분하다.
export function firstAuthor(authors: string): string | null {
  const first = authors.split(/[|,;]/)[0] ?? "";
  const cleaned = first.replace(/\s*(지음|글|그림|저|엮음)\s*$/, "").trim();
  return cleaned || null;
}

// 도서관정보나루(국립중앙도서관 산하 공공 오픈데이터, data4library.kr)를 세 번째 출처로
// 추가했다 — 네이버/알라딘 도서 검색 API가 둘 다 서비스 종료(2026-09)되면서 카카오 외
// 상용 API를 더 쓸 수 없게 됐고, 전국 공공/학교 도서관 소장 데이터 기반이라 절판되거나
// 오래된 그림책·동화책은 오히려 서점 판매 API보다 더 잘 걸릴 것으로 기대해서 선택함.
// 서지정보 위주라 카카오/네이버와 달리 줄거리 설명은 제공하지 않는다(description은 항상 null).
// DATA4LIBRARY_AUTH_KEY가 없거나 실패해도 빈 배열만 돌려줘서 호출부가 조용히 폴백한다.
export async function searchLibraryBooks(query: string, size = 5): Promise<BookCandidate[]> {
  const authKey = process.env.DATA4LIBRARY_AUTH_KEY;
  if (!authKey || !query.trim()) return [];

  try {
    // title 파라미터를 쓴다 — keyword 파라미터는 매뉴얼상 "일치검색 결과만 제공"이라
    // 완전히 같은 제목이 아니면 안 걸린다. title은 기본이 비일치검색(부분 일치)이라
    // 아이가 제목을 다 안 쳤을 때도 자동완성 후보가 뜬다.
    const params = new URLSearchParams({
      authKey,
      title: query.trim(),
      pageNo: "1",
      pageSize: String(size),
      format: "json",
    });
    const response = await fetch(`https://data4library.kr/api/srchBooks?${params}`);
    if (!response.ok) return [];

    const data = (await response.json()) as {
      response?: { docs?: { doc: LibraryBookDoc }[] };
    };
    const docs = data.response?.docs ?? [];
    return docs
      .map(({ doc }) => ({
        title: doc.bookname?.trim() ?? "",
        author: doc.authors ? firstAuthor(doc.authors) : null,
        thumbnail: doc.bookImageURL || null,
        description: null,
      }))
      .filter((candidate) => candidate.title);
  } catch {
    return [];
  }
}
