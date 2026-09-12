import { NextResponse } from "next/server";
import { requireChildProfileForApi } from "@/lib/currentProfile";
import { searchBooks } from "@/lib/kakaoBook";

// /read/new/book에서 책 제목을 타이핑하는 동안 자동완성 후보를 보여주는 데 쓴다. 표지 촬영
// 후보 검색(book-cover-lookup)과 같은 searchBooks()를 재사용한다 — "정확한 제목은 카카오
// 검색 결과에서 사람이 직접 고른다"는 같은 원칙을 텍스트 입력에도 적용하기 위함. 검색 결과가
// 없어도 에러 없이 빈 배열만 돌려줘서, 화면은 항상 직접 입력을 그대로 허용한다.
export async function GET(request: Request) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  if (!query.trim()) return NextResponse.json({ candidates: [] });

  const candidates = await searchBooks(query, 5);
  return NextResponse.json({ candidates });
}
