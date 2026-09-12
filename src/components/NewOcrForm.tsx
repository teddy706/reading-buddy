"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewOcrForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요해요.");

      const { data: profile } = await supabase.from("profiles").select("family_id, id").eq("user_id", user.id).single();
      if (!profile) throw new Error("프로필을 찾을 수 없어요.");

      const extension = file.type.split("/")[1]?.split(";")[0] || "jpg";
      const imagePath = `${profile.family_id}/${profile.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("reading-notes").upload(imagePath, file, {
        contentType: file.type,
      });
      if (uploadError) throw new Error("사진을 올리지 못했어요.");

      const res = await fetch("/api/ocr-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "사진을 처리하지 못했어요.");

      router.push(`/read/ocr/${data.id}/review`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 처리하지 못했어요.");
      setLoading(false);
    }
  }

  return (
    <div className="app-shell justify-center">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">독서노트를 찍어줘</h1>
        <p className="mb-6 text-center text-sm text-soft">노트를 반듯하게 놓고 찍으면 더 잘 읽혀요</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileSelected}
          className="hidden"
        />

        {loading ? (
          <div className="card text-center text-sm text-soft">글자를 읽는 중...</div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-primary">
            📷 사진 찍기 / 고르기
          </button>
        )}

        {error && <p className="mb-2 text-center text-sm font-semibold text-red-500">{error}</p>}
      </div>
    </div>
  );
}
