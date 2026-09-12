import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile } from "@/lib/types";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

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
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">누가 쓸까요?</h1>
      <p className="mb-6 text-center text-sm text-soft">프로필을 골라주세요</p>

      {/* 자녀가 늘어나도(4명+) 넓은 화면에서는 한 줄에 더 많이 보이게 */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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

      <div className="mt-auto flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xs">
        <Link href="/settings" className="btn btn-outline mb-0">
          부모 설정
        </Link>
        <LogoutButton />
      </div>
      </div>
    </div>
  );
}
