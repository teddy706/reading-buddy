import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { RecordDetail } from "@/components/RecordDetail";
import { getAvatarPhotoUrl } from "@/lib/avatarPhoto";
import type { ConversationMessage } from "@/lib/types";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

export default async function RecordDetailPage({ params }: { params: { id: string } }) {
  const viewer = await requireProfile();

  const supabase = createClient();
  const { data: record } = await supabase.from("reading_records").select("*").eq("id", params.id).maybeSingle();
  if (!record) notFound();

  const showChild = viewer.role === "parent";

  // 대화로 만든 기록이면 원본 대화도 같이 가져온다 — RecordDetail이 AI가 정리한 감상문(content)과
  // 아이가 실제로 한 말(messages)을 구분해서 보여준다. conversation_sessions RLS가 reading_records와
  // 동일한 규칙(가족+역할)을 쓰므로 별도 권한 체크 없이 그대로 조회할 수 있다.
  const [{ data: child }, { data: conversation }] = await Promise.all([
    supabase.from("profiles").select("name, avatar, avatar_photo_path").eq("id", record.child_profile_id).maybeSingle(),
    record.source_type === "conversation" && record.source_ref_id
      ? supabase.from("conversation_sessions").select("messages").eq("id", record.source_ref_id).maybeSingle()
      : Promise.resolve({ data: null as { messages: ConversationMessage[] } | null }),
  ]);

  const childPhotoUrl = showChild ? await getAvatarPhotoUrl(supabase, child?.avatar_photo_path) : null;

  return (
    <RecordDetail
      record={record}
      childName={showChild ? child?.name ?? null : null}
      childAvatar={showChild ? child?.avatar ?? null : null}
      childAvatarPhotoUrl={childPhotoUrl}
      conversationMessages={(conversation?.messages as ConversationMessage[] | undefined) ?? null}
      canManageDokseoro={viewer.role === "parent"}
      // 부모 화면(/settings/records)은 자녀별 탭으로 나뉘어 있어서, 이 기록의 주인(child_profile_id)을
      // 쿼리 파라미터로 넘겨야 "뒤로" 눌렀을 때 방금 보고 있던 자녀 탭으로 그대로 돌아간다
      // (ChildRecordsTabs가 이 값을 읽어 초기 탭을 정한다) — 없으면 항상 첫 번째 자녀 탭으로
      // 리셋되는 문제가 있었다(2026-09-12 사용자 피드백).
      backHref={showChild ? `/settings/records?child=${record.child_profile_id}` : "/records"}
    />
  );
}
