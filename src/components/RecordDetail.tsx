"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { DokseoroStatusBadge } from "@/components/DokseoroStatusBadge";
import type { ReadingRecord } from "@/lib/types";

const SOURCE_LABEL: Record<ReadingRecord["source_type"], string> = {
  conversation: "💬 대화로 기록",
  ocr: "📷 독서노트 사진으로 기록",
  manual: "✏️ 직접 입력",
};

export function RecordDetail({
  record,
  childName,
  childAvatar,
  backHref,
}: {
  record: ReadingRecord;
  childName: string | null;
  childAvatar: string | null;
  backHref: string;
}) {
  const router = useRouter();
  const [bookTitle, setBookTitle] = useState(record.book_title);
  const [recordedDate, setRecordedDate] = useState(record.recorded_at);
  const [content, setContent] = useState(record.content);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = bookTitle !== record.book_title || recordedDate !== record.recorded_at || content !== record.content;

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reading-records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle, content, recordedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했어요.");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      {childName && (
        <div className="mb-4 flex items-center gap-2">
          {childAvatar && <Avatar emoji={childAvatar} size="sm" />}
          <span className="text-sm font-semibold text-soft">{childName}의 기록</span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm text-soft">{SOURCE_LABEL[record.source_type]}</span>
        <DokseoroStatusBadge status={record.dokseoro_status} />
      </div>

      <label className="mb-1 text-sm font-semibold text-soft">책 제목</label>
      <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} className="input" />

      <label className="mb-1 text-sm font-semibold text-soft">읽은 날짜</label>
      <input type="date" value={recordedDate} onChange={(e) => setRecordedDate(e.target.value)} className="input" />

      <label className="mb-1 text-sm font-semibold text-soft">내용</label>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input" />

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
      {saved && <p className="mb-2 text-sm font-semibold text-a">저장했어요!</p>}

      <button type="button" onClick={onSave} disabled={!dirty || saving} className="btn btn-primary mb-3">
        {saving ? "저장하는 중..." : "저장"}
      </button>

      <Link href={backHref} className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
