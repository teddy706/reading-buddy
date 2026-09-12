import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { ChildEditCard } from "@/components/ChildEditCard";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile } from "@/lib/types";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

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
  const photoUrls = await getAvatarPhotoUrls(
    supabase,
    childProfiles.map((c) => c.avatar_photo_path)
  );

  return (
    <div className="app-shell">
      <BackLink href="/settings" />
      <h1 className="mb-6 text-center text-2xl font-bold">자녀 프로필 관리</h1>

      {/* lg부터 2열 — 카드 안 이모지 아바타 그리드(8열)가 촘촘해서, 폭이 충분히 넓어지는
          lg(1024px) 이상에서만 2열로 나눈다(md에서 2열로 쪼개면 오히려 더 좁아짐). */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        {childProfiles.map((child) => (
          <ChildEditCard
            key={child.id}
            child={child}
            photoUrl={child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null}
          />
        ))}
      </div>

      <Link href="/profiles/new" className="btn btn-outline">
        + 프로필 추가
      </Link>
    </div>
  );
}
