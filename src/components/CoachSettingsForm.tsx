"use client";

import { useState } from "react";
import type { ReadingCoachStage } from "@/lib/types";
import type { StageInstructions } from "@/lib/readingSession";
import { COACH_PRESETS, type CoachPreset } from "@/lib/coachPresets";

const STAGES: ReadingCoachStage[] = [1, 2, 3];
// 서버(/api/family/coach-settings)의 MAX_LENGTH와 반드시 같은 값을 유지할 것 — 여기서는
// 저장 전에 미리 글자 수를 보여주고 넘으면 막는 용도로만 쓴다(진짜 검증은 서버가 한다).
const MAX_LENGTH = 500;

// 저장된 값이 프리셋 중 하나와 정확히 같으면(공백 트리밍 기준) 그 프리셋을 "적용됨"으로
// 표시해준다 — 안 그러면 설정 화면을 나갔다 다시 들어왔을 때 방금까지 프리셋을 쓰고
// 있었는지 알 길이 없어서, 매번 처음부터 고르는 느낌이 든다.
export function matchingPresetId(values: StageInstructions): string | null {
  const preset = COACH_PRESETS.find((p) => STAGES.every((stage) => p.instructions[stage].trim() === values[stage].trim()));
  return preset?.id ?? null;
}

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
  // 마지막으로 서버에 저장된(또는 기본값으로 되돌린) 값 — 지금 입력창 내용과 비교해서
  // "저장 안 한 변경사항" 여부를 판단하는 기준선이다. onSave/onReset 성공 시에만 갱신된다.
  const [savedValues, setSavedValues] = useState(initialInstructions);
  const [usingDefault, setUsingDefault] = useState(!isCustom);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedPreset, setLoadedPreset] = useState<string | null>(() => matchingPresetId(initialInstructions));
  // 단계별 "미리보기" 결과 — 저장하지 않고도 지금 입력창 문구로 실제 질문이 어떻게
  // 나오는지 바로 확인할 수 있게 한다(부모는 자녀 프로필로 전환하지 않는 한 대화 화면을
  // 직접 써볼 수 없어서, 이 미리보기가 유일한 확인 수단이다).
  const [previewLoading, setPreviewLoading] = useState<ReadingCoachStage | null>(null);
  const [previewResult, setPreviewResult] = useState<Partial<Record<ReadingCoachStage, string>>>({});
  const [previewError, setPreviewError] = useState<Partial<Record<ReadingCoachStage, string>>>({});

  const isDirty = STAGES.some((stage) => values[stage] !== savedValues[stage]);

  function setStageValue(stage: ReadingCoachStage, value: string) {
    setValues((prev) => ({ ...prev, [stage]: value }));
    setLoadedPreset(null);
    setPreviewResult((prev) => ({ ...prev, [stage]: undefined }));
    setPreviewError((prev) => ({ ...prev, [stage]: undefined }));
  }

  async function onPreview(stage: ReadingCoachStage) {
    setPreviewLoading(stage);
    setPreviewError((prev) => ({ ...prev, [stage]: undefined }));
    try {
      const res = await fetch("/api/family/coach-settings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, instruction: values[stage] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "미리보기를 만들지 못했어요.");
      setPreviewResult((prev) => ({ ...prev, [stage]: data.question }));
    } catch (err) {
      setPreviewError((prev) => ({ ...prev, [stage]: err instanceof Error ? err.message : "미리보기를 만들지 못했어요." }));
    } finally {
      setPreviewLoading(null);
    }
  }

  // 프리셋은 아래 입력창의 초안만 바꾼다 — 실제로 가족 설정에 반영되려면 여전히 "저장"을 눌러야
  // 한다(기본값 되돌리기와 같은 원칙: 서버에 반영되는 순간과 화면 미리보기를 분리해둔다).
  function applyPreset(preset: CoachPreset) {
    setValues(preset.instructions);
    setLoadedPreset(preset.id);
    setPreviewResult({});
    setPreviewError({});
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
      setSavedValues(values);
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
      setSavedValues(defaultInstructions);
      setUsingDefault(true);
      setLoadedPreset(matchingPresetId(defaultInstructions));
      setPreviewResult({});
      setPreviewError({});
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
      <div className="mb-3">
        <p className="text-xs text-soft">
          {usingDefault ? "지금은 기본 지침을 쓰고 있어요." : "지금은 우리 가족만의 지침을 쓰고 있어요."}
        </p>
        {isDirty && (
          <p className="mt-0.5 text-xs font-semibold text-accent">
            저장하지 않은 변경사항이 있어요 — 아래 &quot;저장&quot;을 눌러야 반영돼요.
          </p>
        )}
      </div>

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
          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-sm font-semibold text-soft">
              {stage}단계 · {stageLabels[stage]}
            </label>
            <span className={`text-xs ${values[stage].length > MAX_LENGTH ? "font-semibold text-red-500" : "text-soft"}`}>
              {values[stage].length}/{MAX_LENGTH}자
            </span>
          </div>
          <textarea
            value={values[stage]}
            onChange={(e) => setStageValue(stage, e.target.value)}
            rows={4}
            maxLength={MAX_LENGTH}
            className="input"
          />

          <button
            type="button"
            onClick={() => onPreview(stage)}
            disabled={previewLoading === stage || !values[stage].trim()}
            className="btn btn-outline mb-2"
          >
            {previewLoading === stage ? "질문을 만들어보는 중..." : "🔍 이 지침으로 예시 질문 미리보기"}
          </button>

          {previewError[stage] && <p className="mb-2 text-xs font-semibold text-red-500">{previewError[stage]}</p>}
          {previewResult[stage] && (
            <div className="rounded-xl bg-[#f4f0e8] p-3 text-sm">
              <p className="mb-1 text-xs font-semibold text-soft">
                예시(&apos;무지개 물고기&apos;를 읽었다고 가정) — 저장 전 미리보기라 실제와 조금 다를 수 있어요
              </p>
              <p>{previewResult[stage]}</p>
            </div>
          )}
        </div>
      ))}

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
      {saved && <p className="mb-2 text-sm font-semibold text-a">저장했어요!</p>}

      <button type="button" onClick={onSave} disabled={saving || resetting || !isDirty} className="btn btn-primary mb-2">
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
