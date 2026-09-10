import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";
import { RecordCard } from "@/components/RecordCard";
import type { ConversationSession, ReadingRecord } from "@/lib/types";

export default async function HomePage() {
  const child = await requireChildProfile();
  const supabase = createClient();

  const { data: inProgress } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("child_profile_id", child.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  const { data: records } = await supabase
    .from("reading_records")
    .select("*")
    .eq("child_profile_id", child.id)
    .order("recorded_at", { ascending: false })
    .limit(5);

  const sessions = (inProgress ?? []) as ConversationSession[];
  const readingRecords = (records ?? []) as ReadingRecord[];

  return (
    <div className="app-shell">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar emoji={child.avatar} />
          <h1 className="text-xl font-bold">{child.name}의 책장</h1>
        </div>
        <LogoutButton label="나가기" />
      </div>

      <Link href="/read/new" className="btn btn-primary">
        📖 새 기록 시작
      </Link>

      {sessions.map((s) => (
        <Link key={s.id} href={`/read/${s.id}/chat`} className="card block">
          <p className="font-bold">{s.book_title}</p>
          <p className="text-sm text-soft">이어서 쓰기</p>
        </Link>
      ))}

      <div className="mb-2 flex items-center justify-between">
        <p className="font-bold">최근 기록</p>
        <Link href="/records" className="text-sm font-semibold text-accent underline">
          전체 보기
        </Link>
      </div>

      {readingRecords.length === 0 ? (
        <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>
      ) : (
        readingRecords.map((r) => <RecordCard key={r.id} record={r} />)
      )}
    </div>
  );
}
