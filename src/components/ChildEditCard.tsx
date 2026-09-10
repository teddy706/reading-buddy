"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AVATAR_OPTIONS } from "@/components/Avatar";
import { PinDots, PinKeypad } from "@/components/PinKeypad";
import type { Profile } from "@/lib/types";

type PinStep = "closed" | "enter" | "confirm";

export function ChildEditCard({ child }: { child: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(child.name);
  const [avatar, setAvatar] = useState(child.avatar);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pinStep, setPinStep] = useState<PinStep>("closed");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinDone, setPinDone] = useState(false);

  async function saveProfile(next: { name?: string; avatar?: string }) {
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
        <Avatar emoji={avatar} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== child.name && saveProfile({ name })}
          disabled={savingProfile}
          className="input mb-0 flex-1"
        />
      </div>

      <div className="mb-3 grid grid-cols-8 gap-1.5">
        {AVATAR_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setAvatar(option);
              saveProfile({ avatar: option });
            }}
            className={`flex items-center justify-center rounded-xl border-2 p-1 ${
              avatar === option ? "border-accent bg-accent/10" : "border-[#eee]"
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
