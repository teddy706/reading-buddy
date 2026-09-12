import { describe, expect, it } from "vitest";
import { matchingPresetId } from "@/components/CoachSettingsForm";
import { COACH_PRESETS } from "@/lib/coachPresets";
import { DEFAULT_STAGE_INSTRUCTIONS } from "@/lib/readingSession";

describe("matchingPresetId", () => {
  it("프리셋과 정확히 같은 값이면 그 프리셋 id를 돌려준다", () => {
    const preset = COACH_PRESETS[0];
    expect(matchingPresetId(preset.instructions)).toBe(preset.id);
  });

  it("앞뒤 공백만 다르면 여전히 같은 프리셋으로 본다", () => {
    const preset = COACH_PRESETS[0];
    const padded = { 1: `  ${preset.instructions[1]}  `, 2: preset.instructions[2], 3: preset.instructions[3] };
    expect(matchingPresetId(padded)).toBe(preset.id);
  });

  it("기본 지침처럼 어떤 프리셋과도 안 맞으면 null을 돌려준다", () => {
    expect(matchingPresetId(DEFAULT_STAGE_INSTRUCTIONS)).toBeNull();
  });

  it("한 단계만 프리셋과 달라도 매칭되지 않는다", () => {
    const preset = COACH_PRESETS[0];
    const almost = { ...preset.instructions, 2: preset.instructions[2] + " (수정됨)" };
    expect(matchingPresetId(almost)).toBeNull();
  });
});
