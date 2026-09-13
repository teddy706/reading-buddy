import { describe, expect, it } from "vitest";
import { BADGE_CATALOG, computeBadges, computeYearlyChallenges, YEARLY_CHALLENGE_TARGET } from "@/lib/badges";
import type { ReadingRecord } from "@/lib/types";

function record(overrides: Partial<ReadingRecord> = {}): ReadingRecord {
  return {
    id: crypto.randomUUID(),
    family_id: "family-1",
    child_profile_id: "child-1",
    book_title: "책",
    book_author: null,
    page_count: null,
    isbn: null,
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

describe("computeYearlyChallenges", () => {
  it("기록이 하나도 없어도 올해 챌린지는 0권 진행 중으로 포함하고, 월별 내역도 전부 0이다", () => {
    const challenges = computeYearlyChallenges([], "2026");
    expect(challenges).toEqual([
      { year: "2026", count: 0, target: YEARLY_CHALLENGE_TARGET, earned: false, monthlyCounts: new Array(12).fill(0) },
    ]);
  });

  it("연도별로 권수를 세고 목표(100권) 달성 여부를 판정한다", () => {
    const records = [
      ...Array.from({ length: 100 }, () => record({ recorded_at: "2025-05-01" })),
      ...Array.from({ length: 42 }, () => record({ recorded_at: "2026-03-01" })),
    ];
    const challenges = computeYearlyChallenges(records, "2026");
    const y2025 = challenges.find((c) => c.year === "2025");
    expect(y2025?.count).toBe(100);
    expect(y2025?.earned).toBe(true);
    expect(y2025?.monthlyCounts[4]).toBe(100); // index 4 = 5월

    const y2026 = challenges.find((c) => c.year === "2026");
    expect(y2026?.count).toBe(42);
    expect(y2026?.earned).toBe(false);
    expect(y2026?.monthlyCounts[2]).toBe(42); // index 2 = 3월
  });

  it("최신 연도가 먼저 오도록 내림차순 정렬한다", () => {
    const records = [record({ recorded_at: "2024-01-01" }), record({ recorded_at: "2025-01-01" })];
    const challenges = computeYearlyChallenges(records, "2026");
    expect(challenges.map((c) => c.year)).toEqual(["2026", "2025", "2024"]);
  });

  it("기록이 없는 과거 연도는 목록에 넣지 않는다(활동하지 않은 해까지 빈 챌린지로 나열하지 않음)", () => {
    const challenges = computeYearlyChallenges([record({ recorded_at: "2026-01-01" })], "2026");
    expect(challenges).toHaveLength(1);
  });

  it("월별 권수는 그 해의 기록만 반영하고 다른 해 기록은 섞이지 않는다", () => {
    const records = [
      record({ recorded_at: "2026-01-15" }),
      record({ recorded_at: "2026-01-20" }),
      record({ recorded_at: "2025-12-31" }),
    ];
    const challenges = computeYearlyChallenges(records, "2026");
    const y2026 = challenges.find((c) => c.year === "2026")!;
    expect(y2026.monthlyCounts[0]).toBe(2); // 1월
    expect(y2026.monthlyCounts.reduce((a, b) => a + b, 0)).toBe(2);
  });
});
