import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// reading_records의 RLS는 자녀 세션에게 "본인 기록만" 조회를 허용한다(의도된 형제자매 프라이버시
// 경계) — profiles와 달리(가족 구성원끼리는 서로 이름/아바타를 볼 수 있음) 기록 내용은 완전히
// 막혀 있다. 하지만 "이달의 다독왕" 배지는 형제자매 간 이번 달 권수 비교가 필요하므로, 이 배지
// 계산 용도에 한해서만 서비스 역할로 RLS를 우회한다 — book_title/content 등 실제 기록 내용은
// 절대 가져오지 않고 child_profile_id/recorded_at(집계용)만 선택해서 형제자매의 기록 내용이
// 노출되지 않게 한다. 형제자매 목록은 호출부가 profiles 테이블(자녀도 조회 가능)에서 미리 구해
// 넘긴다 — 이번 달 기록이 0건인 형제자매도 0으로 정확히 집계하기 위해서다.
export async function getSiblingsThisMonthCounts(
  familyId: string,
  siblingProfileIds: string[],
  monthKey: string
): Promise<number[]> {
  if (siblingProfileIds.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("reading_records")
    .select("child_profile_id, recorded_at")
    .eq("family_id", familyId)
    .in("child_profile_id", siblingProfileIds);

  const countsByChild = new Map<string, number>(siblingProfileIds.map((id) => [id, 0]));
  for (const row of data ?? []) {
    if (row.recorded_at.slice(0, 7) !== monthKey) continue;
    countsByChild.set(row.child_profile_id, (countsByChild.get(row.child_profile_id) ?? 0) + 1);
  }
  return Array.from(countsByChild.values());
}
