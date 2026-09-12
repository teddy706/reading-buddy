import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { RecordsBrowser } from "@/components/RecordsBrowser";
import { RECORDS_PAGE_SIZE } from "@/lib/recordsPaging";
import type { ReadingRecord } from "@/lib/types";

// Next.js가 fetch() 응답을 기본 캐시(force-cache)하는 바람에, 같은 URL로 나가는 Supabase
// PostgREST 요청이 cookies()로 인한 동적 렌더링과 무관하게 이전 응답을 재사용해 최신
// 기록이 안 보이는 문제가 있었다 — 이 라우트의 Supabase 조회는 항상 새로 가져오게 강제한다.
export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const child = await requireChildProfile();
  const supabase = createClient();

  // 무한 스크롤의 첫 페이지만 서버에서 미리 받아서 빠르게 그린다 — 나머지는
  // RecordsBrowser가 스크롤/검색에 따라 직접 불러온다.
  const { data: records } = await supabase
    .from("reading_records")
    .select("*")
    .eq("child_profile_id", child.id)
    .order("recorded_at", { ascending: false })
    .range(0, RECORDS_PAGE_SIZE - 1);

  const readingRecords = (records ?? []) as ReadingRecord[];

  return (
    <div className="app-shell">
      <BackLink href="/home" />
      <h1 className="mb-6 text-center text-2xl font-bold">내가 기록한 책</h1>

      <RecordsBrowser childId={child.id} initialRecords={readingRecords} />
    </div>
  );
}
