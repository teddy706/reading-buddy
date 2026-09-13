import type { YearlyChallenge } from "@/lib/badges";

export function YearlyChallengeList({ challenges }: { challenges: YearlyChallenge[] }) {
  return (
    <div className="flex flex-col gap-2">
      {challenges.map((c) => {
        const pct = Math.min(100, Math.round((c.count / c.target) * 100));
        return (
          <div
            key={c.year}
            className={`rounded-2xl border-2 p-3 ${c.earned ? "border-ink bg-white" : "border-[#eee] bg-[#f7f3ea]"}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-bold">
                {c.earned ? "🏅" : "📅"} {c.year}년 {c.target}권 챌린지
              </span>
              <span className="text-xs text-soft">
                {c.count}/{c.target}권
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eee]">
              <div className={`h-2 rounded-full ${c.earned ? "bg-a" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
            <MonthlyBreakdown monthlyCounts={c.monthlyCounts} earned={c.earned} />
          </div>
        );
      })}
    </div>
  );
}

// 연간 목표(100권) 진행률만으로는 "몇 월에 몰아 읽었는지"를 알 수 없다는 사용자 피드백으로 추가한
// 월별 미니 막대그래프 — 12개월 전부 늘 표시(그 해가 다 지나지 않았어도 나머지 달은 0권으로 보임).
function MonthlyBreakdown({ monthlyCounts, earned }: { monthlyCounts: number[]; earned: boolean }) {
  const max = Math.max(1, ...monthlyCounts);
  return (
    <div className="mt-2 flex items-end justify-between gap-0.5" style={{ height: 36 }}>
      {monthlyCounts.map((count, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
          <div
            className={`w-full rounded-t-sm ${count > 0 ? (earned ? "bg-a" : "bg-accent") : "bg-[#eee]"}`}
            style={{ height: `${count > 0 ? Math.max(10, (count / max) * 100) : 2}%` }}
            title={`${i + 1}월 ${count}권`}
          />
          <span className="text-[8px] text-soft">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
