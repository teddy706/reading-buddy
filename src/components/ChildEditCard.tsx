"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AVATAR_OPTIONS } from "@/components/Avatar";
import { PinDots, PinKeypad } from "@/components/PinKeypad";
import { AVATAR_PHOTO_BUCKET, avatarPhotoPath } from "@/lib/avatarPhoto";
import type { Profile } from "@/lib/types";

type PinStep = "closed" | "enter" | "confirm";

export function ChildEditCard({ child, photoUrl }: { child: Profile; photoUrl: string | null }) {
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
  const [pinDone, setPinDone] = useState(false);

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
    if (next.length === 4) setTimeout(() => setPinStep("confirm"), 150);
  }

  async function onPinConfirmChange(next: string) {
    setPinError(null);
    setPinConfirm(next);
    if (next.length !== 4) return;
    if (next !== pin) {
      setPinError("PIN이 서로 달라요. 다시 입력해주세요.");
      setPinConfirm("");
      return;
    }
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
  }

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
          disabled={photoLoading}
          className="relative shrink-0"
          aria-label="아바타 사진 올리기"
        >
          <Avatar emoji={avatar} photoUrl={photoUrl} />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-white text-[10px]">
            📷
          </span>
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== child.name && saveProfile({ name })}
          disabled={savingProfile}
          className="input mb-0 flex-1"
        />
      </div>

      {photoError && <p className="mb-2 text-sm font-semibold text-red-500">{photoError}</p>}
      {photoUrl && (
        <button type="button" onClick={removePhoto} disabled={photoLoading} className="btn btn-ghost mb-2">
          {photoLoading ? "처리하는 중..." : "사진 제거하고 이모지로"}
        </button>
      )}

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

      {pinStep === "closed" && (
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
              <PinDots length={4} filled={pinStep === "confirm" ? pinConfirm.length : pin.length} />
              {pinError && <p className="mb-3 text-center text-sm font-semibold text-red-500">{pinError}</p>}
              <PinKeypad
                value={pinStep === "confirm" ? pinConfirm : pin}
                onChange={pinStep === "confirm" ? onPinConfirmChange : onPinChange}
              />
              <button type="button" onClick={() => setPinStep("closed")} className="btn btn-ghost mb-0 mt-2">
                취소
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
