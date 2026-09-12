import { describe, expect, it } from "vitest";
import {
  FALLBACK_QUESTIONS,
  STAGE_LABELS,
  STAGE_PLAN,
  TOTAL_QUESTIONS,
  fallbackQuestion,
  stageForQuestionIndex,
} from "@/lib/readingSession";

describe("stageForQuestionIndex", () => {
  it("STAGE_PLAN과 정확히 같은 순서로 단계를 매핑한다", () => {
    expect(STAGE_PLAN).toEqual([1, 1, 2, 3]);
    STAGE_PLAN.forEach((stage, index) => {
      expect(stageForQuestionIndex(index)).toBe(stage);
    });
  });

  it("TOTAL_QUESTIONS 범위를 벗어나는 인덱스는 마지막 단계(3)로 폴백한다", () => {
    expect(stageForQuestionIndex(TOTAL_QUESTIONS)).toBe(3);
    expect(stageForQuestionIndex(99)).toBe(3);
  });

  it("모든 단계가 STAGE_LABELS에 라벨을 갖는다", () => {
    for (const stage of STAGE_PLAN) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});

describe("fallbackQuestion", () => {
  it("STAGE_PLAN과 1:1로 대응해서 단계별 흐름을 유지한다", () => {
    expect(FALLBACK_QUESTIONS).toHaveLength(STAGE_PLAN.length);
    STAGE_PLAN.forEach((_, index) => {
      expect(fallbackQuestion(index)).toBe(FALLBACK_QUESTIONS[index]);
    });
  });

  it("범위를 벗어난 인덱스는 범용 문구로 폴백한다", () => {
    expect(fallbackQuestion(TOTAL_QUESTIONS)).toBe("그 책에 대해 더 이야기해줄래?");
  });
});
