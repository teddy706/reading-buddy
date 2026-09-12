import { describe, expect, it } from "vitest";
import { countByMonth, lastNMonths } from "@/lib/readingStats";
import type { ReadingRecord } from "@/lib/types";

function record(recordedAt: string): ReadingRecord {
  return {
    id: crypto.randomUUID(),
    family_id: "family-1",
    child_profile_id: "child-1",
    book_title: "책",
    book_author: null,
    page_count: null,
    source_type: "manual",
    content: "내용",
    source_ref_id: null,
    recorded_at: recordedAt,
    dokseoro_status: "pending",
    created_at: `${recordedAt}T00:00:00.000Z`,
    updated_at: `${recordedAt}T00:00:00.000Z`,
  };
}

describe("lastNMonths", () => {
  it("이번 달을 포함해 오래된 순으로 n개월을 반환한다", () => {
    const months = lastNMonths(3, new Date(2026, 8, 15)); // 2026-09-15 (월은 0-indexed)
    expect(months).toEqual([
      { key: "2026-07", label: "7월" },
      { key: "2026-08", label: "8월" },
      { key: "2026-09", label: "9월" },
    ]);
  });

  it("연도를 걸치는 구간도 올바르게 넘어간다", () => {
    const months = lastNMonths(3, new Date(2026, 1, 1)); // 2026-02-01
    expect(months.map((m) => m.key)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("countByMonth", () => {
  it("recorded_at의 연-월이 일치하는 기록만 센다", () => {
    const records = [record("2026-09-01"), record("2026-09-30"), record("2026-08-31"), record("2026-10-01")];
    expect(countByMonth(records, "2026-09")).toBe(2);
  });

  it("일치하는 기록이 없으면 0을 반환한다", () => {
    expect(countByMonth([record("2026-01-01")], "2026-09")).toBe(0);
  });
});
