import type { BadgeProgress } from "@/lib/badges";

export function BadgeGrid({ badges }: { badges: BadgeProgress[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {badges.map(({ badge, earned, progressText }) => (
        <div
          key={badge.id}
          className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center ${
            earned ? "border-ink bg-white" : "border-[#eee] bg-[#f7f3ea] opacity-60"
          }`}
          title={badge.description}
        >
          <span className={`text-2xl ${earned ? "" : "grayscale"}`}>{badge.emoji}</span>
          <span className="text-xs font-bold">{badge.title}</span>
          <span className="text-[10px] text-soft">{progressText}</span>
        </div>
      ))}
    </div>
  );
}
