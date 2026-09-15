import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";
import { RecordCard } from "@/components/RecordCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { YearlyChallengeList } from "@/components/YearlyChallengeList";
import { computeBadges, computeYearlyChallenges } from "@/lib/badges";
import { getSiblingsThisMonthCounts } from "@/lib/siblingReadingCounts";
import { lastNMonths, currentYearKey } from "@/lib/readingStats";
import { getAvatarPhotoUrl } from "@/lib/avatarPhoto";
import { isDemoFamily } from "@/lib/demoMode";
import type { ConversationSession, Profile, ReadingRecord } from "@/lib/types";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const child = await requireChildProfile();
  const supabase = createClient();

  // 서로 의존하지 않는 조회는 병렬로 날린다 — 순서대로 하나씩 기다리면 Supabase 왕복
  // 지연이 그대로 누적돼 화면 전환이 느려 보인다(사용자 피드백). 최근 5건/전체 기록도
  // 같은 테이블·같은 필터라 한 번만 조회해서 클라이언트에서 잘라 쓰도록 합쳤다.
  const [photoUrl, inProgressResult, allRecordsResult, siblingsResult, isDemo] = await Promise.all([
    getAvatarPhotoUrl(supabase, child.avatar_photo_path),
    supabase
      .from("conversation_sessions")
      .select("*")
      .eq("child_profile_id", child.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false }),
    supabase.from("reading_records").select("*").eq("child_profile_id", child.id).order("recorded_at", { ascending: false }),
    // 형제자매 이름/아바타는 profiles RLS가 같은 가족이면 자녀도 조회 가능하게 해준다(프로필
    // 선택 화면과 동일). 하지만 형제자매의 reading_records 내용은 RLS가 막아두므로("본인 것만"),
    // "이달의 다독왕" 배지에 필요한 이번 달 권수만 서비스 역할로 별도 집계한다(아래,
    // getSiblingsThisMonthCounts — 실제 기록 내용은 가져오지 않음).
    supabase.from("profiles").select("id").eq("family_id", child.family_id).eq("role", "child").neq("id", child.id),
    isDemoFamily(child.family_id, supabase),
  ]);

  // 데모 계정은 방문자마다 새로 "대화 시작"을 체험하면서 완료하지 않은 세션이 계속 쌓일 수
  // 있어서(finish 라우트가 저장 대신 정리하지만, 도중에 그냥 나가면 남는다) "이어서 쓰기"
  // 목록에는 보여주지 않는다 — 다른 방문자가 만든 낯선 세션이 여기 뜨는 걸 막기 위함.
  const sessions = isDemo ? [] : ((inProgressResult.data ?? []) as ConversationSession[]);
  const myRecords = (allRecordsResult.data ?? []) as ReadingRecord[];
  const readingRecords = myRecords.slice(0, 5);
  const siblingProfiles = (siblingsResult.data ?? []) as Pick<Profile, "id">[];

  const thisMonthKey = lastNMonths(1)[0].key;
  const siblingsThisMonthCounts = await getSiblingsThisMonthCounts(
    child.family_id,
    siblingProfiles.map((s) => s.id),
    thisMonthKey
  );
  const badges = computeBadges(myRecords, siblingsThisMonthCounts, thisMonthKey);
  const yearlyChallenges = computeYearlyChallenges(myRecords, currentYearKey());

  return (
    <div className="app-shell">
      <div className="mx-auto w-full max-w-xl">
      {isDemo && (
        <div className="mb-4 rounded-2xl border-2 border-accent bg-accent/10 p-3 text-center text-sm font-semibold">
          🎈 데모 체험 중이에요 — 아래 기록은 미리 준비된 예시예요
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar emoji={child.avatar} photoUrl={photoUrl} />
          <h1 className="text-xl font-bold">{child.name}의 책장</h1>
        </div>
        <LogoutButton label="나가기" className="btn-pill" />
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

      <p className="mb-2 font-bold">연간 독서 챌린지</p>
      <div className="card">
        <YearlyChallengeList challenges={yearlyChallenges} />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="font-bold">최근 기록</p>
        <Link href="/records" className="btn-pill">
          전체 보기
        </Link>
      </div>

      {readingRecords.length === 0 ? (
        <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>
      ) : (
        readingRecords.map((r) => <RecordCard key={r.id} record={r} />)
      )}
      </div>
    </div>
  );
}
