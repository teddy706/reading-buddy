"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OcrReview({
  uploadId,
  imageUrl,
  failed,
  initialBookTitle,
  initialContent,
}: {
  uploadId: string;
  imageUrl: string | null;
  failed: boolean;
  initialBookTitle: string;
  initialContent: string;
}) {
  const router = useRouter();
  const [bookTitle, setBookTitle] = useState(initialBookTitle);
  const [content, setContent] = useState(initialContent);
  const [recordedDate, setRecordedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/ocr-uploads/${uploadId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle, content, recordedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했어요.");
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <h1 className="mb-1 text-center text-xl font-bold">내용을 확인해줘</h1>
      <p className="mb-4 text-center text-sm text-soft">글자가 이상하면 고쳐도 돼요</p>

      {failed && (
        <p className="mb-3 rounded-2xl border-2 border-ink bg-white p-3 text-center text-sm text-soft">
          사진에서 글자를 잘 못 읽었어요. 아래 칸에 직접 적어줘도 괜찮아요.
        </p>
      )}

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="독서노트 사진" className="mb-3 max-h-64 w-full rounded-2xl border-2 border-ink object-contain" />
      )}

      <label className="mb-1 text-sm font-semibold text-soft">책 제목</label>
      <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="책 제목" className="input" />

      <label className="mb-1 text-sm font-semibold text-soft">읽은 날짜</label>
      <input
        type="date"
        value={recordedDate}
        onChange={(e) => setRecordedDate(e.target.value)}
        className="input"
      />

      <label className="mb-1 text-sm font-semibold text-soft">내용</label>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input" />

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}

      <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary mt-auto mb-0">
        {saving ? "저장하는 중..." : "저장"}
      </button>
    </div>
  );
}
