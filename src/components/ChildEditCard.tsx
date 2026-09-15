"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AVATAR_OPTIONS } from "@/components/Avatar";
import { PinDots, PinKeypad, PinConfirmButton } from "@/components/PinKeypad";
import { AVATAR_PHOTO_BUCKET, avatarPhotoPath } from "@/lib/avatarPhoto";
import type { Profile } from "@/lib/types";

type PinStep = "closed" | "enter" | "confirm";
type DeleteStep = "closed" | "confirm";

export function ChildEditCard({
  child,
  photoUrl,
  readOnly = false,
}: {
  child: Profile;
  photoUrl: string | null;
  // 데모 체험 계정에서는 API가 어차피 막지만(demoMode.ts), 사진 올리기·PIN 재설정·삭제처럼
  // 여러 단계를 거친 뒤에야 막혔다는 걸 알게 되는 막다른 흐름을 피하려고 버튼 자체를 미리 끈다.
  readOnly?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(child.name);
  const [avatar, setAvatar] = useState(child.avatar);
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pinStep, setPinStep] = useState<PinStep>("closed");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinDone, setPinDone] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("closed");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function saveProfile(next: { name?: string; avatar?: string; avatarPhotoPath?: string | null }) {
    setSavingProfile(true);
    try {
      await fetch(`/api/children/${child.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("사진 크기는 5MB 이하로 올려주세요.");
      return;
    }
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      const supabase = createClient();
      const path = avatarPhotoPath(child.family_id, child.id);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_PHOTO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error("사진을 올리지 못했어요.");

      await saveProfile({ avatarPhotoPath: path });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "사진을 올리지 못했어요.");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function removePhoto() {
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      await saveProfile({ avatarPhotoPath: null });
    } finally {
      setPhotoLoading(false);
    }
  }

  function startPinReset() {
    setPinStep("enter");
    setPin("");
    setPinConfirm("");
    setPinError(null);
    setPinDone(false);
  }

  function onPinChange(next: string) {
    setPinError(null);
    setPin(next);
  }

  function goToPinConfirm() {
    if (pin.length !== 4) return;
    setPinStep("confirm");
  }

  function onPinConfirmChange(next: string) {
    setPinError(null);
    setPinConfirm(next);
  }

  async function submitPinReset() {
    if (pinConfirm.length !== 4) return;
    if (pinConfirm !== pin) {
      setPinError("PIN이 서로 달라요. 다시 입력해주세요.");
      setPinConfirm("");
      return;
    }
    setPinSubmitting(true);
    try {
      const res = await fetch(`/api/children/${child.id}/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error ?? "PIN을 변경하지 못했어요.");
        setPinStep("enter");
        setPin("");
        setPinConfirm("");
        return;
      }
      setPinDone(true);
      setTimeout(() => setPinStep("closed"), 1200);
    } finally {
      setPinSubmitting(false);
    }
  }

  async function deleteChild() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/children/${child.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "삭제하지 못했어요.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      setDeleteError("삭제하지 못했어요.");
      setDeleting(false);
    }
  }

  const pinCurrentValue = pinStep === "confirm" ? pinConfirm : pin;

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPhotoSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photoLoading || readOnly}
          className="relative shrink-0"
          aria-label="아바타 사진 올리기"
        >
          <Avatar emoji={avatar} photoUrl={photoUrl} />
          {!readOnly && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-white text-[10px]">
              📷
            </span>
          )}
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== child.name && saveProfile({ name })}
          disabled={savingProfile || readOnly}
          // min-w-0: 옆의 고정폭 아바타 버튼과 함께 flex 행에 있는데, input의 기본 최소
          // 너비(auto)가 좁은 화면에서 줄어드는 걸 막을 수 있어서 명시적으로 풀어준다.
          className="input mb-0 min-w-0 flex-1"
        />
      </div>

      {photoLoading && <p className="mb-2 text-xs font-semibold text-soft">사진 처리하는 중...</p>}
      {photoError && <p className="mb-2 text-sm font-semibold text-red-500">{photoError}</p>}
      {photoUrl && !photoLoading && !readOnly && (
        <button type="button" onClick={removePhoto} className="btn btn-ghost mb-2">
          사진 제거하고 이모지로
        </button>
      )}

      {!readOnly && (
        <>
          <p className="mb-2 text-xs text-soft">{photoUrl ? "사진 대신 이모지를 쓰려면 아래에서 골라주세요" : "이모지 아바타"}</p>
          <div className="mb-3 grid grid-cols-8 gap-1.5">
            {AVATAR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setAvatar(option);
                  saveProfile({ avatar: option, avatarPhotoPath: photoUrl ? null : undefined });
                }}
                className={`flex items-center justify-center rounded-xl border-2 p-1 ${
                  avatar === option && !photoUrl ? "border-accent bg-accent/10" : "border-[#eee]"
                }`}
              >
                <Avatar emoji={option} size="sm" />
              </button>
            ))}
          </div>
        </>
      )}

      {!readOnly && pinStep === "closed" && (
        <button type="button" onClick={startPinReset} className="btn btn-outline mb-0">
          PIN 재설정
        </button>
      )}

      {pinStep !== "closed" && (
        <div className="rounded-2xl border-2 border-[#eee] p-4">
          {pinDone ? (
            <p className="text-center font-semibold text-a">PIN이 바뀌었어요!</p>
          ) : (
            <>
              <p className="mb-3 text-center text-sm font-semibold">
                {pinStep === "confirm" ? "PIN을 한 번 더 입력해주세요" : "새 PIN 4자리를 입력해주세요"}
              </p>
              <PinDots length={4} filled={pinCurrentValue.length} />
              {pinError && <p className="mb-3 text-center text-sm font-semibold text-red-500">{pinError}</p>}
              <PinKeypad
                value={pinCurrentValue}
                onChange={pinStep === "confirm" ? onPinConfirmChange : onPinChange}
                disabled={pinSubmitting}
              />
              <PinConfirmButton
                ready={pinCurrentValue.length === 4}
                loading={pinSubmitting}
                onClick={pinStep === "confirm" ? submitPinReset : goToPinConfirm}
                label={pinStep === "confirm" ? "완료" : "다음"}
              />
              <button
                type="button"
                onClick={() => setPinStep("closed")}
                disabled={pinSubmitting}
                className="btn btn-ghost mb-0 mt-2"
              >
                취소
              </button>
            </>
          )}
        </div>
      )}

      {readOnly ? (
        <p className="mb-0 mt-2 text-center text-xs text-soft">데모 체험 계정에서는 이름·PIN·삭제를 바꿀 수 없어요</p>
      ) : deleteStep === "closed" ? (
        <button
          type="button"
          onClick={() => setDeleteStep("confirm")}
          className="btn btn-ghost mb-0 mt-2 text-red-500"
        >
          자녀 프로필 삭제
        </button>
      ) : (
        <div className="mt-2 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-center text-sm font-semibold text-red-600">
            {child.name}의 프로필과 독서 기록이 전부 사라져요. 되돌릴 수 없어요.
          </p>
          {deleteError && <p className="mb-3 text-center text-sm font-semibold text-red-500">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteStep("closed")}
              disabled={deleting}
              className="btn btn-ghost mb-0 flex-1"
            >
              취소
            </button>
            <button
              type="button"
              onClick={deleteChild}
              disabled={deleting}
              className="btn mb-0 flex-1 bg-red-500 text-white disabled:opacity-50"
            >
              {deleting ? "삭제하는 중..." : "정말 삭제할래요"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
