import { Suspense } from "react";
import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { ChildRecordsTabs } from "@/components/ChildRecordsTabs";
import { RECORDS_PAGE_SIZE } from "@/lib/recordsPaging";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile, ReadingRecord } from "@/lib/types";

// /records와 동일한 이유(Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지) — 캐시 관련
// 코멘트는 src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

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

  const tabsData = childrenData.map(({ child, initialRecords, totalCount }) => ({
    child,
    initialRecords,
    totalCount,
    photoUrl: child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null,
  }));

  return (
    <div className="app-shell">
      <BackLink href="/settings" />
      <h1 className="mb-6 text-center text-2xl font-bold">자녀 독서 기록</h1>

      {childProfiles.length === 0 ? (
        <p className="mb-4 text-center text-sm text-soft">아직 자녀 프로필이 없어요.</p>
      ) : (
        // ChildRecordsTabs가 선택된 탭을 URL 쿼리(?child=)로 관리하느라 useSearchParams()를
        // 쓰는데, Next.js는 이 훅을 쓰는 클라이언트 컴포넌트를 Suspense로 감싸도록 요구한다
        // (안 감싸면 빌드 경고/실패, "missing-suspense-with-csr-bailout").
        <Suspense fallback={null}>
          <ChildRecordsTabs childrenData={tabsData} />
        </Suspense>
      )}
    </div>
  );
}
