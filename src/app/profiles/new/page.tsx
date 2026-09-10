"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AVATAR_OPTIONS } from "@/components/Avatar";
import { PinDots, PinKeypad } from "@/components/PinKeypad";

type Step = "info" | "pin" | "pinConfirm";

export default function NewProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function goToPin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setStep("pin");
  }

  function onPinChange(next: string) {
    setError(null);
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => setStep("pinConfirm"), 150);
    }
  }

  async function onPinConfirmChange(next: string) {
    setError(null);
    setPinConfirm(next);
    if (next.length !== 4) return;
    if (next !== pin) {
      setError("PIN이 서로 달라요. 다시 입력해주세요.");
      setPinConfirm("");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "프로필을 만들지 못했어요.");
        setStep("pin");
        setPin("");
        setPinConfirm("");
        return;
      }
      router.push("/profiles");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (step === "info") {
    return (
      <div className="app-shell justify-center">
        <h1 className="mb-6 text-center text-2xl font-bold">프로필 추가</h1>
        <form className="card" onSubmit={goToPin}>
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
          <p className="mb-2 text-sm font-semibold text-soft">아바타 선택</p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {AVATAR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAvatar(option)}
                className={`flex items-center justify-center rounded-2xl border-2 p-2 ${
                  avatar === option ? "border-accent bg-accent/10" : "border-[#eee]"
                }`}
              >
                <Avatar emoji={option} />
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-primary mb-0">
            다음: PIN 설정
          </button>
        </form>
      </div>
    );
  }

  const isConfirmStep = step === "pinConfirm";
  return (
    <div className="app-shell justify-center">
      <h1 className="mb-2 text-center text-2xl font-bold">
        {isConfirmStep ? "PIN을 한 번 더" : `${name}의 PIN`}
      </h1>
      <p className="mb-6 text-center text-sm text-soft">
        {isConfirmStep ? "확인을 위해 다시 입력해주세요" : "숫자 4자리를 입력해주세요"}
      </p>
      <PinDots length={4} filled={isConfirmStep ? pinConfirm.length : pin.length} />
      {error && <p className="mb-4 text-center text-sm font-semibold text-red-500">{error}</p>}
      <PinKeypad
        value={isConfirmStep ? pinConfirm : pin}
        onChange={isConfirmStep ? onPinConfirmChange : onPinChange}
        disabled={loading}
      />
    </div>
  );
}
