"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABELS } from "@/lib/readingSession";
import type { ConversationSession, ReadingCoachStage } from "@/lib/types";

interface EssayData {
  essay: string;
  stageAnswers: Record<ReadingCoachStage, string[]>;
  notes: string[];
}

const STAGE_ORDER: ReadingCoachStage[] = [1, 2, 3];

// 감상문 프롬프트가 "문단 사이는 줄바꿈 하나로 구분"하도록 지시하므로 빈 줄 유무와 무관하게
// 비어있지 않은 줄 단위로 나누면 처음/가운데/끝 3문단과 1:1로 맞아떨어진다.
function splitParagraphs(essay: string): string[] {
  return essay
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function ReviewSession({ session }: { session: ConversationSession }) {
  const router = useRouter();
  const [data, setData] = useState<EssayData | null>(null);
  const [essay, setEssay] = useState("");
  const [generating, setGenerating] = useState(true);
  // AI 도움이 큰 만큼 아이가 최소 한 번은 감상문을 읽고 나서 등록되면 좋겠다는 피드백(2026-09-12)
  // 에 따라, 생성 직후 바로 저장 가능한 대신 먼저 "내가 한 말 → 감상문" 비교를 보여주고
  // 확인 버튼을 눌러야 편집/저장 화면으로 넘어가게 한다.
  const [confirmedRead, setConfirmedRead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateEssay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateEssay() {
    setGenerating(true);
    setConfirmedRead(false);
    setError(null);
    try {
      const res = await fetch(`/api/reading-sessions/${session.id}/essay`, { method: "POST" });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error ?? "감상문을 만들지 못했어요.");
      setData(resData);
      setEssay(resData.essay);
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
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error ?? "저장하지 못했어요.");
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  const paragraphs = data ? splitParagraphs(data.essay) : [];

  return (
    <div className="app-shell">
      <h1 className="mb-1 text-center text-xl font-bold">{session.book_title}</h1>
      {session.book_page_count != null && (
        <p className="mb-1 text-center text-xs text-soft">총 {session.book_page_count}쪽</p>
      )}
      <p className="mb-4 text-center text-sm text-soft">
        {!generating && data && !confirmedRead
          ? "내가 한 말이 어떻게 다듬어졌는지 읽어보자"
          : "감상문을 확인하고 고쳐도 돼요"}
      </p>

      {generating && <div className="card text-center text-sm text-soft">감상문을 쓰는 중...</div>}

      {!generating && data && !confirmedRead && (
        <>
          <div className="mb-3 flex flex-1 flex-col gap-3 overflow-y-auto">
            {STAGE_ORDER.map((stage, i) => (
              <div key={stage} className="card">
                <p className="mb-1 text-xs font-semibold text-accent">{STAGE_LABELS[stage]}</p>
                <p className="mb-2 text-sm leading-relaxed">{paragraphs[i] ?? ""}</p>
                {data.stageAnswers[stage]?.length > 0 && (
                  <div className="mb-2 rounded-xl bg-[#f4f0e8] p-2 text-xs text-soft">
                    <p className="mb-1 font-semibold">내가 한 말</p>
                    {data.stageAnswers[stage].map((a, idx) => (
                      <p key={idx}>&ldquo;{a}&rdquo;</p>
                    ))}
                  </div>
                )}
                {data.notes[i] && <p className="text-xs font-semibold text-a">💡 {data.notes[i]}</p>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setConfirmedRead(true)} className="btn btn-primary mb-0">
            다 읽었어요, 확인했어요!
          </button>
        </>
      )}

      {!generating && data && confirmedRead && (
        <>
          <textarea value={essay} onChange={(e) => setEssay(e.target.value)} rows={8} className="input" />

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

          <div className="mt-auto flex flex-col gap-2">
            <button type="button" onClick={onSave} disabled={saving || !essay.trim()} className="btn btn-primary mb-0">
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
        </>
      )}

      {error && <p className="mb-2 mt-2 text-sm font-semibold text-red-500">{error}</p>}
    </div>
  );
}
