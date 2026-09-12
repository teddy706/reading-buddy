"use client";

import { useState } from "react";
import type { ReadingCoachStage } from "@/lib/types";
import type { StageInstructions } from "@/lib/readingSession";

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

  function setStageValue(stage: ReadingCoachStage, value: string) {
    setValues((prev) => ({ ...prev, [stage]: value }));
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
