import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { RecordCard } from "@/components/RecordCard";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile, ReadingRecord } from "@/lib/types";

export default async function ParentRecordsPage() {
  const parent = await requireParentProfile();
  const supabase = createClient();

  const [childrenResult, recordsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("family_id", parent.family_id)
      .eq("role", "child")
      .order("created_at", { ascending: true }),
    supabase.from("reading_records").select("*").eq("family_id", parent.family_id).order("recorded_at", { ascending: false }),
  ]);
  const { data: children } = childrenResult;
  const { data: records } = recordsResult;

  const childProfiles = (children ?? []) as Profile[];
  const readingRecords = (records ?? []) as ReadingRecord[];
  const photoUrls = await getAvatarPhotoUrls(
    supabase,
    childProfiles.map((c) => c.avatar_photo_path)
  );

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">자녀 독서 기록</h1>

      {childProfiles.length === 0 && (
        <p className="mb-4 text-center text-sm text-soft">아직 자녀 프로필이 없어요.</p>
      )}

      {childProfiles.map((child) => {
        const childRecords = readingRecords.filter((r) => r.child_profile_id === child.id);
        return (
          <div key={child.id} className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <Avatar
                emoji={child.avatar}
                photoUrl={child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null}
                size="sm"
              />
              <span className="font-bold">{child.name}</span>
              <span className="text-sm text-soft">· {childRecords.length}권</span>
            </div>
            {childRecords.length === 0 ? (
              <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>
            ) : (
              childRecords.map((r) => <RecordCard key={r.id} record={r} />)
            )}
          </div>
        );
      })}

      <Link href="/settings" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
