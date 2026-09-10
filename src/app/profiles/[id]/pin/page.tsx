import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { PinEntry } from "@/components/PinEntry";

export default async function ProfilePinPage({ params }: { params: { id: string } }) {
  const requester = await requireProfile();

  const supabase = createClient();
  const { data: child } = await supabase
    .from("profiles")
    .select("id, name, avatar")
    .eq("id", params.id)
    .eq("family_id", requester.family_id)
    .eq("role", "child")
    .maybeSingle();

  if (!child) notFound();

  return (
    <div className="app-shell justify-center">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Avatar emoji={child.avatar} size="lg" />
        <h1 className="text-2xl font-bold">{child.name}</h1>
        <p className="text-sm text-soft">PIN 4자리를 입력해주세요</p>
      </div>
      <PinEntry profileId={child.id} />
    </div>
  );
}
