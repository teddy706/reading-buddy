import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 감상문 확인/편집 화면에서 "저장"을 누르면 호출된다. reading_records 를 만들고
// 대화 세션은 completed 로 표시한다. '독서로' 동기화는 아직 구현 전이라 dokseoro_status는
// 기본값 pending 그대로 둔다(Phase 1 "4. 독서로 자동 연동" 소관).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { essay } = await request.json();

  if (typeof essay !== "string" || !essay.trim()) {
    return NextResponse.json({ error: "감상문 내용이 비어있어요." }, { status: 400 });
  }

  const { data: session, error: fetchError } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !session) {
    return NextResponse.json({ error: "대화 세션을 찾을 수 없어요." }, { status: 404 });
  }

  const { data: record, error: insertError } = await supabase
    .from("reading_records")
    .insert({
      family_id: session.family_id,
      child_profile_id: session.child_profile_id,
      book_title: session.book_title,
      book_author: session.book_author,
      source_type: "conversation",
      content: essay.trim(),
      source_ref_id: session.id,
    })
    .select()
    .single();

  if (insertError || !record) {
    return NextResponse.json({ error: "기록을 저장하지 못했어요." }, { status: 500 });
  }

  await supabase.from("conversation_sessions").update({ status: "completed" }).eq("id", session.id);

  return NextResponse.json({ ok: true, recordId: record.id });
}
