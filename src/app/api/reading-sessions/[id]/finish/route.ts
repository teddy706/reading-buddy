import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChildProfileForApi } from "@/lib/currentProfile";
import { isDemoFamily } from "@/lib/demoMode";

// 감상문 확인/편집 화면에서 "저장"을 누르면 호출된다. reading_records 를 만들고
// 대화 세션은 completed 로 표시한다. '독서로' 동기화는 아직 구현 전이라 dokseoro_status는
// 기본값 pending 그대로 둔다(Phase 1 "4. 독서로 자동 연동" 소관).
// /read/[id]/review 페이지 자체가 자녀 전용(requireChildProfile)이라 이 라우트도 동일하게 막는다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;

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

  // 데모 계정은 대화/감상문 생성 자체는 실제 AI 호출로 체험할 수 있게 허용하지만(사용자 확인
  // 완료, 2026-09-15), 다른 방문자도 함께 보는 데모용 시딩 데이터(reading_records)를 실제로
  // 늘리지는 않는다 — 저장 대신 이 대화 세션만 정리(삭제)하고 "체험 완료"로 응답한다.
  if (await isDemoFamily(profile.family_id, supabase)) {
    // conversation_sessions에는 RLS delete 정책이 없어(reading-sessions/[id]/route.ts와 동일한
    // 이유) admin 클라이언트로 지운다.
    await createAdminClient().from("conversation_sessions").delete().eq("id", session.id);
    return NextResponse.json({ ok: true, demo: true });
  }

  const { data: record, error: insertError } = await supabase
    .from("reading_records")
    .insert({
      family_id: session.family_id,
      child_profile_id: session.child_profile_id,
      book_title: session.book_title,
      book_author: session.book_author,
      page_count: session.book_page_count,
      isbn: session.book_isbn,
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
