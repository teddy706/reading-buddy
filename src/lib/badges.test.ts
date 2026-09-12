import { describe, expect, it } from "vitest";
import { BADGE_CATALOG, computeBadges } from "@/lib/badges";
import type { ReadingRecord } from "@/lib/types";

function record(overrides: Partial<ReadingRecord> = {}): ReadingRecord {
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
    recorded_at: "2026-09-01",
    dokseoro_status: "pending",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeBadges", () => {
  it("형제자매가 없으면 이달의 다독왕 배지를 카탈로그에서 제외한다", () => {
    const badges = computeBadges([], [], "2026-09");
    expect(badges).toHaveLength(BADGE_CATALOG.length - 1);
    expect(badges.some((b) => b.badge.id === "monthly-champion")).toBe(false);
  });

  it("기록이 하나도 없으면 아무 배지도 획득하지 못한다", () => {
    const badges = computeBadges([], [3], "2026-09");
    for (const b of badges) expect(b.earned).toBe(false);
  });

  it("누적 권수 배지(첫 걸음/책벌레/독서왕)는 정확한 경계에서 획득된다", () => {
    const fourRecords = Array.from({ length: 4 }, () => record());
    const badges4 = computeBadges(fourRecords, [], "2026-09");
    expect(badges4.find((b) => b.badge.id === "first-book")?.earned).toBe(true);
    expect(badges4.find((b) => b.badge.id === "five-books")?.earned).toBe(false);

    const tenRecords = Array.from({ length: 10 }, () => record());
    const badges10 = computeBadges(tenRecords, [], "2026-09");
    expect(badges10.find((b) => b.badge.id === "five-books")?.earned).toBe(true);
    expect(badges10.find((b) => b.badge.id === "ten-books")?.earned).toBe(true);
  });

  it("기록 방식별 배지는 해당 source_type만 센다", () => {
    const records = [
      record({ source_type: "conversation" }),
      record({ source_type: "conversation" }),
      record({ source_type: "conversation" }),
      record({ source_type: "ocr" }),
    ];
    const badges = computeBadges(records, [], "2026-09");
    expect(badges.find((b) => b.badge.id === "storyteller")?.earned).toBe(true);
    expect(badges.find((b) => b.badge.id === "photo-detective")?.earned).toBe(false);
    expect(badges.find((b) => b.badge.id === "photo-detective")?.progressText).toBe("1/3회");
  });

  it("독서로 지킴이는 synced 상태만 센다", () => {
    const records = [
      ...Array.from({ length: 5 }, () => record({ dokseoro_status: "synced" })),
      record({ dokseoro_status: "pending" }),
    ];
    const badges = computeBadges(records, [], "2026-09");
    expect(badges.find((b) => b.badge.id === "dokseoro-keeper")?.earned).toBe(true);
  });

  describe("이달의 다독왕", () => {
    it("이번 달 기록이 형제자매의 최댓값 이상일 때만 획득한다", () => {
      const records = [record({ recorded_at: "2026-09-05" }), record({ recorded_at: "2026-09-10" })];
      const losing = computeBadges(records, [3], "2026-09");
      expect(losing.find((b) => b.badge.id === "monthly-champion")?.earned).toBe(false);

      const winning = computeBadges(records, [2], "2026-09");
      expect(winning.find((b) => b.badge.id === "monthly-champion")?.earned).toBe(true);
    });

    it("동률이면 둘 다 획득한다(형제자매 최댓값과 같으면 true)", () => {
      const records = [record({ recorded_at: "2026-09-05" }), record({ recorded_at: "2026-09-10" })];
      const tie = computeBadges(records, [2], "2026-09");
      expect(tie.find((b) => b.badge.id === "monthly-champion")?.earned).toBe(true);
    });

    it("이번 달 기록이 0건이면 형제자매도 0권이어도 획득하지 못한다", () => {
      const records = [record({ recorded_at: "2026-08-01" })];
      const badges = computeBadges(records, [0], "2026-09");
      expect(badges.find((b) => b.badge.id === "monthly-champion")?.earned).toBe(false);
    });

    it("지난달 기록은 이번 달 카운트에 포함하지 않는다", () => {
      const records = [record({ recorded_at: "2026-08-31" }), record({ recorded_at: "2026-09-01" })];
      const badges = computeBadges(records, [0], "2026-09");
      expect(badges.find((b) => b.badge.id === "monthly-champion")?.progressText).toBe("이번 달 1권");
    });
  });
});
