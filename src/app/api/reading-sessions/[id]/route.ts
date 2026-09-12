import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChildProfileForApi } from "@/lib/currentProfile";

// 대화 중 "취소"를 누르면 세션 자체를 지운다(감상문을 만들지 않고 완전히 포기하는 경우).
// "다음에 작성"은 세션이 이미 in_progress 상태로 저장돼 있어 별도 API 호출 없이
// 그냥 나가면 되고(홈의 "이어서 쓰기"가 집어준다), 여기서는 취소 경로만 다룬다.
// conversation_sessions에는 RLS delete 정책이 없어(런타임 삭제는 서버에서만) admin
// 클라이언트를 쓰되, 삭제 전에 본인 소유의 in_progress 세션인지 먼저 확인한다.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("conversation_sessions")
    .select("id")
    .eq("id", params.id)
    .eq("child_profile_id", profile.id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "대화를 찾을 수 없어요." }, { status: 404 });
  }

  const { error } = await admin.from("conversation_sessions").delete().eq("id", session.id);
  if (error) {
    return NextResponse.json({ error: "취소하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
