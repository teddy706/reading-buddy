import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { RecordsList } from "@/components/RecordsList";
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

      <RecordsList records={readingRecords} />

      <Link href="/home" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
