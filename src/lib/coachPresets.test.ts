import { describe, expect, it } from "vitest";
import { COACH_PRESETS } from "@/lib/coachPresets";

describe("COACH_PRESETS", () => {
  it("프리셋마다 1/2/3단계 지침을 전부 갖고 있다", () => {
    for (const preset of COACH_PRESETS) {
      expect(preset.instructions[1]?.trim()).toBeTruthy();
      expect(preset.instructions[2]?.trim()).toBeTruthy();
      expect(preset.instructions[3]?.trim()).toBeTruthy();
    }
  });

  it("프리셋 id가 서로 겹치지 않는다", () => {
    const ids = COACH_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("프리셋마다 표시용 emoji/title/description을 갖고 있다", () => {
    for (const preset of COACH_PRESETS) {
      expect(preset.emoji).toBeTruthy();
      expect(preset.title.trim()).toBeTruthy();
      expect(preset.description.trim()).toBeTruthy();
    }
  });
});
