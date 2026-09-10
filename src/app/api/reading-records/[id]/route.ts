import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 자녀(본인 기록만) 또는 부모(가족 내 모든 기록)가 책 제목/날짜/내용을 고칠 수 있다(PRD 5.2(5)
// "부모의 기록 검토 및 수정 권한"). 소유권 확인은 reading_records_update RLS 정책이 전담한다.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { bookTitle, content, recordedDate } = await request.json();

  const update: { book_title?: string; content?: string; recorded_at?: string } = {};
  if (typeof bookTitle === "string" && bookTitle.trim()) update.book_title = bookTitle.trim();
  if (typeof content === "string" && content.trim()) update.content = content.trim();
  if (typeof recordedDate === "string" && recordedDate) update.recorded_at = recordedDate;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const { error } = await supabase.from("reading_records").update(update).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
