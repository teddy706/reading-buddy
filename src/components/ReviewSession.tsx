"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationSession } from "@/lib/types";

export function ReviewSession({ session }: { session: ConversationSession }) {
  const router = useRouter();
  const [essay, setEssay] = useState("");
  const [generating, setGenerating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateEssay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateEssay() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reading-sessions/${session.id}/essay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "감상문을 만들지 못했어요.");
      setEssay(data.essay);
    } catch (err) {
      setError(err instanceof Error ? err.message : "감상문을 만들지 못했어요.");
    } finally {
      setGenerating(false);
    }
  }

  async function onSave() {
    if (!essay.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reading-sessions/${session.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay }),
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
      <h1 className="mb-1 text-center text-xl font-bold">{session.book_title}</h1>
      <p className="mb-4 text-center text-sm text-soft">감상문을 확인하고 고쳐도 돼요</p>

      {generating ? (
        <div className="card text-center text-sm text-soft">감상문을 쓰는 중...</div>
      ) : (
        <>
          <textarea
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            rows={8}
            className="input"
          />

          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="mb-3 text-left text-sm font-semibold text-accent underline"
          >
            {showTranscript ? "대화 내용 접기" : "원본 대화 펼쳐보기"}
          </button>

          {showTranscript && (
            <div className="card">
              {(session.messages ?? []).map((m, i) => (
                <p key={i} className={`mb-2 text-sm ${m.role === "child" ? "font-semibold" : "text-soft"}`}>
                  {m.role === "child" ? "나: " : "질문: "}
                  {m.content}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}

      <div className="mt-auto flex flex-col gap-2">
        <button type="button" onClick={onSave} disabled={generating || saving || !essay.trim()} className="btn btn-primary mb-0">
          {saving ? "저장하는 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/read/${session.id}/chat`)}
          disabled={saving}
          className="btn btn-outline mb-0"
        >
          다시 대화하기
        </button>
      </div>
    </div>
  );
}
