import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile } from "@/lib/types";

export default async function ProfilesPage() {
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
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">누가 쓸까요?</h1>
      <p className="mb-6 text-center text-sm text-soft">프로필을 골라주세요</p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {childProfiles.map((child) => (
          <Link key={child.id} href={`/profiles/${child.id}/pin`} className="profile-card">
            <Avatar
              emoji={child.avatar}
              photoUrl={child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null}
              size="lg"
            />
            <span className="font-bold">{child.name}</span>
          </Link>
        ))}
        <Link href="/profiles/new" className="profile-card border-dashed text-soft">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-soft text-3xl">
            +
          </span>
          <span className="font-bold">프로필 추가</span>
        </Link>
      </div>

      {childProfiles.length === 0 && (
        <p className="mb-4 text-center text-sm text-soft">아직 자녀 프로필이 없어요. 위에서 추가해주세요.</p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Link href="/settings" className="btn btn-outline mb-0">
          부모 설정
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
