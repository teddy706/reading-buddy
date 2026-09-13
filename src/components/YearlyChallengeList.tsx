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
          </div>
        );
      })}
    </div>
  );
}
