import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { RecordsBrowser, RECORDS_PAGE_SIZE } from "@/components/RecordsBrowser";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile, ReadingRecord } from "@/lib/types";

export default async function ParentRecordsPage() {
  const parent = await requireParentProfile();
  const supabase = createClient();

  const { data: children } = await supabase
    .from("profiles")
    .select("*")
    .eq("family_id", parent.family_id)
    .eq("role", "child")
    .order("created_at", { ascending: true });
  const childProfiles = (children ?? []) as Profile[];

  // 자녀마다 무한 스크롤의 첫 페이지 + 전체 권수(head count, 행은 안 받아와서 가볍다)를
  // 병렬로 가져온다. 나머지 페이지는 RecordsBrowser가 스크롤/검색에 따라 직접 불러온다.
  const [childrenData, photoUrls] = await Promise.all([
    Promise.all(
      childProfiles.map(async (child) => {
        const [pageResult, countResult] = await Promise.all([
          supabase
            .from("reading_records")
            .select("*")
            .eq("child_profile_id", child.id)
            .order("recorded_at", { ascending: false })
            .range(0, RECORDS_PAGE_SIZE - 1),
          supabase.from("reading_records").select("*", { count: "exact", head: true }).eq("child_profile_id", child.id),
        ]);
        return {
          child,
          initialRecords: (pageResult.data ?? []) as ReadingRecord[],
          totalCount: countResult.count ?? 0,
        };
      })
    ),
    getAvatarPhotoUrls(
      supabase,
      childProfiles.map((c) => c.avatar_photo_path)
    ),
  ]);

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">자녀 독서 기록</h1>

      {childProfiles.length === 0 && (
        <p className="mb-4 text-center text-sm text-soft">아직 자녀 프로필이 없어요.</p>
      )}

      {childrenData.map(({ child, initialRecords, totalCount }) => (
        <div key={child.id} className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <Avatar
              emoji={child.avatar}
              photoUrl={child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null}
              size="sm"
            />
            <span className="font-bold">{child.name}</span>
            <span className="text-sm text-soft">· {totalCount}권</span>
          </div>
          <RecordsBrowser childId={child.id} initialRecords={initialRecords} />
        </div>
      ))}

      <Link href="/settings" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
