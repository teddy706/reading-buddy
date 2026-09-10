import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/currentProfile";
import { analyzeImageBytes } from "@/lib/documentIntelligence";
import { guessCoverTitle } from "@/lib/azureOpenAI";
import { searchBooks } from "@/lib/kakaoBook";

// 표지 사진 -> OCR -> AI로 제목 추정 -> 카카오 도서 검색 후보 목록을 한 번에 처리한다.
// 이 사진은 검색 보조용 일회성 자료라 Storage/DB에 저장하지 않고 요청-응답 안에서만 다룬다.
// OCR/AI 추정이 실패해도 에러를 던지지 않고 빈 후보 목록을 반환해서, 화면은 항상 "직접 입력"
// 경로로 자연스럽게 폴백할 수 있게 한다(Phase 1 OCR 기능과 같은 원칙).
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "사진 정보가 없어요." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const rawText = await analyzeImageBytes(bytes, file.type);
    const guess = await guessCoverTitle(rawText);
    const candidates = guess.title ? await searchBooks(guess.title) : [];
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ candidates: [] });
  }
}
