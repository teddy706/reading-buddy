"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AVATAR_OPTIONS } from "@/components/Avatar";
import { PinDots, PinKeypad, PinConfirmButton } from "@/components/PinKeypad";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_PHOTO_BUCKET, avatarPhotoPath } from "@/lib/avatarPhoto";

type Step = "info" | "pin" | "pinConfirm";

export default function NewProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("사진 크기는 5MB 이하로 올려주세요.");
      return;
    }
    setError(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function removePhotoSelection() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  }

  function goToPin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setStep("pin");
  }

  function onPinChange(next: string) {
    setError(null);
    setPin(next);
  }

  function goToPinConfirm() {
    if (pin.length !== 4) return;
    setStep("pinConfirm");
  }

  function onPinConfirmChange(next: string) {
    setError(null);
    setPinConfirm(next);
  }

  async function submitPin() {
    if (pinConfirm.length !== 4) return;
    if (pinConfirm !== pin) {
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

      if (photoFile) {
        try {
          const supabase = createClient();
          const path = avatarPhotoPath(data.profile.family_id, data.profile.id);
          const { error: uploadError } = await supabase.storage
            .from(AVATAR_PHOTO_BUCKET)
            .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
          if (uploadError) throw uploadError;
          await fetch(`/api/children/${data.profile.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatarPhotoPath: path }),
          });
        } catch {
          // 사진 업로드가 실패해도 프로필 생성 자체는 끝났으니 등록을 막지 않는다 —
          // 나중에 자녀 프로필 관리 화면에서 다시 올릴 수 있다.
        }
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
          <div className="mb-4 flex items-center gap-3">
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
              className="relative shrink-0"
              aria-label="아이 사진 올리기"
            >
              <Avatar emoji={avatar} photoUrl={photoPreviewUrl} />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-white text-[10px]">
                📷
              </span>
            </button>
            {photoPreviewUrl ? (
              <button type="button" onClick={removePhotoSelection} className="text-sm text-soft underline">
                사진 빼고 이모지 쓰기
              </button>
            ) : (
              <p className="text-sm text-soft">사진을 올리면 이모지 대신 보여요 (선택)</p>
            )}
          </div>
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
                onClick={() => {
                  setAvatar(option);
                  if (photoPreviewUrl) removePhotoSelection();
                }}
                className={`flex items-center justify-center rounded-2xl border-2 p-2 ${
                  avatar === option && !photoPreviewUrl ? "border-accent bg-accent/10" : "border-[#eee]"
                }`}
              >
                <Avatar emoji={option} />
              </button>
            ))}
          </div>
          {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
          <button type="submit" className="btn btn-primary mb-0">
            다음: PIN 설정
          </button>
        </form>
      </div>
    );
  }

  const isConfirmStep = step === "pinConfirm";
  const currentValue = isConfirmStep ? pinConfirm : pin;
  return (
    <div className="app-shell justify-center">
      <h1 className="mb-2 text-center text-2xl font-bold">
        {isConfirmStep ? "PIN을 한 번 더" : `${name}의 PIN`}
      </h1>
      <p className="mb-6 text-center text-sm text-soft">
        {isConfirmStep ? "확인을 위해 다시 입력해주세요" : "숫자 4자리를 입력해주세요"}
      </p>
      <PinDots length={4} filled={currentValue.length} />
      {error && <p className="mb-4 text-center text-sm font-semibold text-red-500">{error}</p>}
      <PinKeypad value={currentValue} onChange={isConfirmStep ? onPinConfirmChange : onPinChange} disabled={loading} />
      <PinConfirmButton
        ready={currentValue.length === 4}
        loading={loading}
        onClick={isConfirmStep ? submitPin : goToPinConfirm}
        label={isConfirmStep ? "완료" : "다음"}
        loadingLabel="만드는 중..."
      />
    </div>
  );
}
