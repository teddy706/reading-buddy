import type { DokseoroStatus } from "@/lib/types";

const LABELS: Record<DokseoroStatus, { text: string; className: string }> = {
  pending: { text: "독서로 미반영", className: "bg-white text-soft" },
  synced: { text: "독서로 반영됨", className: "bg-a-light text-ink" },
  failed: { text: "독서로 반영 실패", className: "bg-red-100 text-red-600" },
};

export function DokseoroStatusBadge({ status }: { status: DokseoroStatus }) {
  const { text, className } = LABELS[status];
  return (
    <span className={`inline-block rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold ${className}`}>
      {text}
    </span>
  );
}
