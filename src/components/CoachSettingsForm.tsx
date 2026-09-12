"use client";

import { useState } from "react";
import type { ReadingCoachStage } from "@/lib/types";
import type { StageInstructions } from "@/lib/readingSession";
import { COACH_PRESETS, type CoachPreset } from "@/lib/coachPresets";

const STAGES: ReadingCoachStage[] = [1, 2, 3];

export function CoachSettingsForm({
  defaultInstructions,
  initialInstructions,
  isCustom,
  stageLabels,
}: {
  defaultInstructions: StageInstructions;
  initialInstructions: StageInstructions;
  isCustom: boolean;
  stageLabels: Record<ReadingCoachStage, string>;
}) {
  const [values, setValues] = useState(initialInstructions);
  const [usingDefault, setUsingDefault] = useState(!isCustom);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedPreset, setLoadedPreset] = useState<string | null>(null);

  function setStageValue(stage: ReadingCoachStage, value: string) {
    setValues((prev) => ({ ...prev, [stage]: value }));
    setLoadedPreset(null);
  }

  // 프리셋은 아래 입력창의 초안만 바꾼다 — 실제로 가족 설정에 반영되려면 여전히 "저장"을 눌러야
  // 한다(기본값 되돌리기와 같은 원칙: 서버에 반영되는 순간과 화면 미리보기를 분리해둔다).
  function applyPreset(preset: CoachPreset) {
    setValues(preset.instructions);
    setLoadedPreset(preset.id);
  }

  async function patchInstructions(body: { instructions: StageInstructions | null }) {
    const res = await fetch("/api/family/coach-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "저장하지 못했어요.");
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await patchInstructions({ instructions: values });
      setUsingDefault(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    setResetting(true);
    setError(null);
    try {
      await patchInstructions({ instructions: null });
      setValues(defaultInstructions);
      setUsingDefault(true);
      setLoadedPreset(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "되돌리지 못했어요.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-soft">
        {usingDefault ? "지금은 기본 지침을 쓰고 있어요." : "지금은 우리 가족만의 지침을 쓰고 있어요."}
      </p>

      <p className="mb-2 text-sm font-semibold text-soft">프리셋으로 빠르게 시작하기</p>
      <div className="mb-2 flex flex-col gap-2">
        {COACH_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`card block text-left ${loadedPreset === preset.id ? "border-accent" : ""}`}
          >
            <p className="font-bold">
              {preset.emoji} {preset.title}
            </p>
            <p className="text-sm text-soft">{preset.description}</p>
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-soft">
        프리셋을 누르면 아래 내용이 바뀌어요 — 마음에 들면 저장을 눌러야 실제로 적용돼요.
      </p>

      {STAGES.map((stage) => (
        <div key={stage} className="mb-3">
          <label className="mb-1 text-sm font-semibold text-soft">
            {stage}단계 · {stageLabels[stage]}
          </label>
          <textarea
            value={values[stage]}
            onChange={(e) => setStageValue(stage, e.target.value)}
            rows={4}
            className="input"
          />
        </div>
      ))}

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
      {saved && <p className="mb-2 text-sm font-semibold text-a">저장했어요!</p>}

      <button type="button" onClick={onSave} disabled={saving || resetting} className="btn btn-primary mb-2">
        {saving ? "저장하는 중..." : "저장"}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={saving || resetting || usingDefault}
        className="btn btn-outline mb-0"
      >
        {resetting ? "되돌리는 중..." : "기본값으로 되돌리기"}
      </button>
    </div>
  );
}
