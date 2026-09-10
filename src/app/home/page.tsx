import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";
import { RecordCard } from "@/components/RecordCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { computeBadges } from "@/lib/badges";
import { getSiblingsThisMonthCounts } from "@/lib/siblingReadingCounts";
import { lastNMonths } from "@/lib/readingStats";
import type { ConversationSession, Profile, ReadingRecord } from "@/lib/types";

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

  // 배지 계산에는 최근 5건이 아니라 이 아이의 전체 기록이 필요하다.
  const { data: myAllRecords } = await supabase.from("reading_records").select("*").eq("child_profile_id", child.id);

  // 형제자매 이름/아바타는 profiles RLS가 같은 가족이면 자녀도 조회 가능하게 해준다(프로필
  // 선택 화면과 동일). 하지만 형제자매의 reading_records 내용은 RLS가 막아두므로("본인 것만"),
  // "이달의 다독왕" 배지에 필요한 이번 달 권수만 서비스 역할로 별도 집계한다
  // (getSiblingsThisMonthCounts — 실제 기록 내용은 가져오지 않음).
  const { data: siblings } = await supabase
    .from("profiles")
    .select("id")
    .eq("family_id", child.family_id)
    .eq("role", "child")
    .neq("id", child.id);

  const sessions = (inProgress ?? []) as ConversationSession[];
  const readingRecords = (records ?? []) as ReadingRecord[];
  const myRecords = (myAllRecords ?? []) as ReadingRecord[];
  const siblingProfiles = (siblings ?? []) as Pick<Profile, "id">[];

  const thisMonthKey = lastNMonths(1)[0].key;
  const siblingsThisMonthCounts = await getSiblingsThisMonthCounts(
    child.family_id,
    siblingProfiles.map((s) => s.id),
    thisMonthKey
  );
  const badges = computeBadges(myRecords, siblingsThisMonthCounts, thisMonthKey);

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

      <p className="mb-2 font-bold">내 배지</p>
      <div className="card">
        <BadgeGrid badges={badges} />
      </div>

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
