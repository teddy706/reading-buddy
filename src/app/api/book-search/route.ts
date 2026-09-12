import { NextResponse } from "next/server";
import { requireChildProfileForApi } from "@/lib/currentProfile";
import { searchBooksMultiSource } from "@/lib/bookSearch";
import { guessCorrectedBookTitle } from "@/lib/azureOpenAI";

// /read/new/book에서 책 제목을 타이핑하는 동안 자동완성 후보를 보여주는 데 쓴다. 표지 촬영
// 후보 검색(book-cover-lookup)과 같은 searchBooksMultiSource()를 재사용한다(카카오+네이버+
// 도서관정보나루 동시 검색) — "정확한 제목은 검색 결과에서 사람이 직접 고른다"는 원칙을
// 텍스트 입력에도 적용하기 위함. 검색 결과가 없어도 에러 없이 빈 배열만 돌려줘서, 화면은
// 항상 직접 입력을 그대로 허용한다.
//
// 첫 검색이 0건이면, 도서 검색 API에는 없는 오타 교정을 AI로 한 번 보완한다(guessCorrectedBookTitle)
// — 검색이 성공하는 대부분의 경우엔 이 AI 호출 자체가 일어나지 않는다.
export async function GET(request: Request) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  if (!query.trim()) return NextResponse.json({ candidates: [] });

  let candidates = await searchBooksMultiSource(query, 5);

  if (candidates.length === 0) {
    const corrected = await guessCorrectedBookTitle(query);
    if (corrected && corrected.trim().toLowerCase() !== query.trim().toLowerCase()) {
      candidates = await searchBooksMultiSource(corrected, 5);
    }
  }

  return NextResponse.json({ candidates });
}
