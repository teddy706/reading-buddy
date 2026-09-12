import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { RecordsBrowser, RECORDS_PAGE_SIZE } from "@/components/RecordsBrowser";
import type { ReadingRecord } from "@/lib/types";

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
      <h1 className="mb-6 text-center text-2xl font-bold">내가 기록한 책</h1>

      <RecordsBrowser childId={child.id} initialRecords={readingRecords} />

      <Link href="/home" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
