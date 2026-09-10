import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { RecordDetail } from "@/components/RecordDetail";

export default async function RecordDetailPage({ params }: { params: { id: string } }) {
  const viewer = await requireProfile();

  const supabase = createClient();
  const { data: record } = await supabase.from("reading_records").select("*").eq("id", params.id).maybeSingle();
  if (!record) notFound();

  const { data: child } = await supabase
    .from("profiles")
    .select("name, avatar")
    .eq("id", record.child_profile_id)
    .maybeSingle();

  const showChild = viewer.role === "parent";

  return (
    <RecordDetail
      record={record}
      childName={showChild ? child?.name ?? null : null}
      childAvatar={showChild ? child?.avatar ?? null : null}
      backHref={showChild ? "/settings/records" : "/records"}
    />
  );
}
