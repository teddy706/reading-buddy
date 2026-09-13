import { requireParentProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { lastNMonths, countByMonth } from "@/lib/readingStats";
import { getAvatarPhotoUrls } from "@/lib/avatarPhoto";
import type { Profile, ReadingRecord, RecordSourceType, DokseoroStatus } from "@/lib/types";

const SOURCE_LABEL: Record<RecordSourceType, string> = {
  conversation: "💬 대화",
  ocr: "📷 독서노트",
  manual: "✏️ 직접 입력",
};

const CHILD_BAR_COLOR = ["bg-a", "bg-b", "bg-accent"];
const CHILD_DOT_COLOR = ["bg-a", "bg-b", "bg-accent"];

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const parent = await requireParentProfile();
  const supabase = createClient();

  const [childrenResult, recordsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("family_id", parent.family_id)
      .eq("role", "child")
      .order("created_at", { ascending: true }),
    supabase.from("reading_records").select("*").eq("family_id", parent.family_id),
  ]);
  const { data: children } = childrenResult;
  const { data: records } = recordsResult;

  const childProfiles = (children ?? []) as Profile[];
  const readingRecords = (records ?? []) as ReadingRecord[];
  const photoUrls = await getAvatarPhotoUrls(
    supabase,
    childProfiles.map((c) => c.avatar_photo_path)
  );

  const months = lastNMonths(6);
  const currentMonthKey = months[months.length - 1].key;

  const perChildMonthly = childProfiles.map((child) => {
    const childRecords = readingRecords.filter((r) => r.child_profile_id === child.id);
    return {
      child,
      counts: months.map((m) => countByMonth(childRecords, m.key)),
      total: childRecords.length,
      thisMonth: countByMonth(childRecords, currentMonthKey),
    };
  });

  const maxCount = Math.max(1, ...perChildMonthly.flatMap((c) => c.counts));
  // 막대 폭을 자녀 수에 맞춰 줄인다 — 고정 폭(예: 12px)이면 자녀가 3명 이상일 때 6개월 x
  // 자녀 수만큼의 막대가 카드 폭보다 넓어져 모바일에서 오른쪽으로 넘쳐흘렀다(사용자 피드백:
  // "독서량 추이 그래프가 밖으로 빠져나와"). 자녀가 많을수록 막대를 가늘게 만들어 6개월 x
  // 자녀 수 막대가 항상 카드 안에 들어오게 한다.
  const barWidthPx = perChildMonthly.length <= 2 ? 12 : perChildMonthly.length === 3 ? 9 : 7;

  const sourceCounts: Record<RecordSourceType, number> = { conversation: 0, ocr: 0, manual: 0 };
  const dokseoroCounts: Record<DokseoroStatus, number> = { pending: 0, synced: 0, failed: 0 };
  readingRecords.forEach((r) => {
    sourceCounts[r.source_type] += 1;
    dokseoroCounts[r.dokseoro_status] += 1;
  });
  const totalRecords = readingRecords.length;

  return (
    <div className="app-shell">
      <BackLink href="/settings" />
      <h1 className="mb-6 text-center text-2xl font-bold">독서 통계</h1>

      {childProfiles.length === 0 ? (
        <p className="mb-4 text-center text-sm text-soft">아직 자녀 프로필이 없어요.</p>
      ) : (
        <>
          <div
            className="mb-3.5 grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}
          >
            {perChildMonthly.map(({ child, total, thisMonth }) => (
              <div key={child.id} className="card mb-0 p-3 text-center">
                <div className="mb-2 flex flex-col items-center gap-1">
                  <Avatar
                    emoji={child.avatar}
                    photoUrl={child.avatar_photo_path ? (photoUrls.get(child.avatar_photo_path) ?? null) : null}
                    size="sm"
                  />
                  <span className="whitespace-nowrap text-sm font-bold">{child.name}</span>
                </div>
                <p className="text-3xl font-bold text-accent">
                  {total}
                  <span className="text-base font-normal text-soft">권</span>
                </p>
                <p className="whitespace-nowrap text-xs text-soft">이번 달 {thisMonth}권</p>
              </div>
            ))}
          </div>

          <div className="card">
            <p className="mb-4 font-bold">최근 6개월 독서량 추이</p>
            {/* overflow-x-auto: 막대 폭을 자녀 수에 맞춰 줄여도 혹시 더 좁은 화면이나 더 많은
                자녀 수에서 여전히 안 들어맞을 때, 페이지 전체가 옆으로 밀리는 대신 이 차트
                영역 안에서만 스크롤되게 하는 안전장치. */}
            <div className="overflow-x-auto">
              <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
                {months.map((m, mi) => (
                  <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <div className="flex h-full items-end gap-1">
                      {perChildMonthly.map(({ counts }, ci) => {
                        const count = counts[mi];
                        const heightPct = Math.max(4, (count / maxCount) * 100);
                        return (
                          <div
                            key={ci}
                            className={`shrink-0 rounded-t-md ${CHILD_BAR_COLOR[ci % CHILD_BAR_COLOR.length]}`}
                            style={{ width: barWidthPx, height: `${heightPct}%` }}
                            title={`${count}권`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-soft">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
              {perChildMonthly.map(({ child }, i) => (
                <span key={child.id} className="flex items-center gap-1.5 whitespace-nowrap text-xs text-soft">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${CHILD_DOT_COLOR[i % CHILD_DOT_COLOR.length]}`} />
                  {child.name}
                </span>
              ))}
            </div>
          </div>

          {totalRecords > 0 && (
            // md부터 두 카드를 나란히 — 둘 다 짧은 요약 카드라 세로로 길게 쌓일 필요가 없다.
            <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
              <div className="card">
                <p className="mb-3 font-bold">기록 방식</p>
                {(Object.keys(sourceCounts) as RecordSourceType[]).map((type) => (
                  <div key={type} className="mb-2 last:mb-0">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{SOURCE_LABEL[type]}</span>
                      <span className="text-soft">{sourceCounts[type]}건</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eee]">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(sourceCounts[type] / totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <p className="mb-3 font-bold">&apos;독서로&apos; 반영 현황</p>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-2xl bg-a-light p-3 text-center">
                    <p className="text-2xl font-bold">{dokseoroCounts.synced}</p>
                    <p className="text-xs text-soft">반영 완료</p>
                  </div>
                  <div className="flex-1 rounded-2xl bg-[#f4f0e8] p-3 text-center">
                    <p className="text-2xl font-bold">{dokseoroCounts.pending + dokseoroCounts.failed}</p>
                    <p className="text-xs text-soft">아직 미반영</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
