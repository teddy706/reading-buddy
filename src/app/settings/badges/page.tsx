import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { BadgeGrid } from "@/components/BadgeGrid";
import { computeBadges } from "@/lib/badges";
import { lastNMonths, countByMonth } from "@/lib/readingStats";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile, ReadingRecord } from "@/lib/types";

export default async function BadgesPage() {
  const parent = await requireParentProfile();
  const supabase = createClient();

  const [childrenResult, recordsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("family_id", parent.family_id)
      .eq("role", "child")
      .order("created_at", { ascending: true }),
    supabase.from("reading_records").select("*").eq("family_id", parent.family_id),
  ]);
  const { data: children } = childrenResult;
  const { data: records } = recordsResult;

  const childProfiles = (children ?? []) as Profile[];
  const readingRecords = (records ?? []) as ReadingRecord[];
  const photoUrls = await getAvatarPhotoUrls(
    supabase,
    childProfiles.map((c) => c.avatar_photo_path)
  );
  const thisMonthKey = lastNMonths(1)[0].key;

  const recordsByChild = new Map(childProfiles.map((c) => [c.id, readingRecords.filter((r) => r.child_profile_id === c.id)]));

  const perChild = childProfiles.map((child) => {
    const myRecords = recordsByChild.get(child.id) ?? [];
    const siblingsThisMonthCounts = childProfiles
      .filter((c) => c.id !== child.id)
      .map((c) => countByMonth(recordsByChild.get(c.id) ?? [], thisMonthKey));
    return {
      child,
      badges: computeBadges(myRecords, siblingsThisMonthCounts, thisMonthKey),
    };
  });

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">배지 비교</h1>

      {childProfiles.length === 0 ? (
        <p className="mb-4 text-center text-sm text-soft">아직 자녀 프로필이 없어요.</p>
      ) : (
        perChild.map(({ child, badges }) => {
          const earnedCount = badges.filter((b) => b.earned).length;
          return (
            <div key={child.id} className="card">
              <div className="mb-3 flex items-center gap-2">
                <Avatar
                  emoji={child.avatar}
                  photoUrl={child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null}
                  size="sm"
                />
                <span className="font-bold">{child.name}</span>
                <span className="text-sm text-soft">· {earnedCount}/{badges.length}개 획득</span>
              </div>
              <BadgeGrid badges={badges} />
            </div>
          );
        })
      )}

      <Link href="/settings" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
