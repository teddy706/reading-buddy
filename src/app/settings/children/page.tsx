import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { ChildEditCard } from "@/components/ChildEditCard";
import type { Profile } from "@/lib/types";

export default async function SettingsChildrenPage() {
  const parent = await requireParentProfile();

  const supabase = createClient();
  const { data: children } = await supabase
    .from("profiles")
    .select("*")
    .eq("family_id", parent.family_id)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  const childProfiles = (children ?? []) as Profile[];

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">자녀 프로필 관리</h1>

      {childProfiles.map((child) => (
        <ChildEditCard key={child.id} child={child} />
      ))}

      <Link href="/profiles/new" className="btn btn-outline">
        + 프로필 추가
      </Link>

      <Link href="/settings" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
