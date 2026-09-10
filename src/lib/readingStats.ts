import type { ReadingRecord } from "@/lib/types";

export interface MonthBucket {
  key: string; // "YYYY-MM"
  label: string; // "9월"
}

// 최근 n개월(이번 달 포함)을 오래된 순으로 반환한다. 차트의 x축으로 사용.
export function lastNMonths(n: number, from: Date = new Date()): MonthBucket[] {
  const months: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: `${d.getMonth() + 1}월` });
  }
  return months;
}

export function countByMonth(records: ReadingRecord[], monthKey: string): number {
  return records.filter((r) => r.recorded_at.slice(0, 7) === monthKey).length;
}
