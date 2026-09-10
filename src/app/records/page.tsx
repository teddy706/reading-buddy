import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { RecordCard } from "@/components/RecordCard";
import type { ReadingRecord } from "@/lib/types";

export default async function RecordsPage() {
  const child = await requireChildProfile();
  const supabase = createClient();

  const { data: records } = await supabase
    .from("reading_records")
    .select("*")
    .eq("child_profile_id", child.id)
    .order("recorded_at", { ascending: false });

  const readingRecords = (records ?? []) as ReadingRecord[];

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">내가 기록한 책</h1>

      {readingRecords.length === 0 ? (
        <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>
      ) : (
        readingRecords.map((r) => <RecordCard key={r.id} record={r} />)
      )}

      <Link href="/home" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
