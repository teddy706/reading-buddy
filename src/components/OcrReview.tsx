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
  // OCR/AI 구조화는 원문을 제목/내용으로만 나누고 페이지 수는 짓지 않는다(사실을 지어내지
  // 않는다는 PRD 8절 원칙 — 숫자는 특히 잘못 지어내기 쉬워서 항상 사람이 직접 입력한다).
  const [pageCount, setPageCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (!bookTitle.trim() || bookTitle.trim().length < 2) {
      setError("책 표지에 적힌 정확한 제목을 입력해주세요.");
      return;
    }
    const parsedPageCount = Number(pageCount);
    if (!pageCount.trim() || !Number.isInteger(parsedPageCount) || parsedPageCount <= 0) {
      setError("책 뒷면이나 마지막 쪽에 적힌 페이지 수를 숫자로 입력해주세요.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/ocr-uploads/${uploadId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle, content, recordedDate, pageCount: parsedPageCount }),
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
      <input
        value={bookTitle}
        onChange={(e) => setBookTitle(e.target.value)}
        placeholder="책 표지에 적힌 정확한 제목"
        className="input"
      />

      <label className="mb-1 text-sm font-semibold text-soft">책 페이지 수 (책 뒷면·마지막 쪽에 있어요)</label>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="예: 132"
        value={pageCount}
        onChange={(e) => setPageCount(e.target.value)}
        className="input"
      />

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
