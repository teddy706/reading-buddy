"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_QUESTIONS, STAGE_LABELS, stageForQuestionIndex } from "@/lib/readingSession";
import type { ConversationMessage, ConversationSession } from "@/lib/types";

export function ChatSession({ session }: { session: ConversationSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConversationMessage[]>(session.messages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // undefined = 아직 조회 전, null = 카카오에서 이 책 정보를 못 찾음, string = 찾은 줄거리 요약.
  // 질문 생성이 어떤 정보를 참고했는지(또는 못 찾아서 제목만으로 질문 중인지) 아이에게 보여준다.
  const [bookContext, setBookContext] = useState<string | null | undefined>(undefined);
  const [showBookContext, setShowBookContext] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const answeredCount = messages.filter((m) => m.role === "child").length;

  useEffect(() => {
    if (messages.length === 0) void askNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function askNext(answerText?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reading-sessions/${session.id}/next-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answerText ? { answerText } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "문제가 생겼어요.");
      setMessages(data.messages);
      if (data.done) {
        router.push(`/read/${session.id}/review`);
        return;
      }
      setBookContext(data.bookContext ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문제가 생겼어요.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelSession() {
    if (answeredCount > 0 && !window.confirm("지금까지 답한 내용이 사라져요. 정말 취소할까요?")) return;
    setCancelling(true);
    try {
      await fetch(`/api/reading-sessions/${session.id}`, { method: "DELETE" });
    } finally {
      router.push("/home");
    }
  }

  async function submitAnswer() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await askNext(text);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        await transcribe(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("마이크를 사용할 수 없어요. 글자로 답해줘도 괜찮아요.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    setLoading(true);
    try {
      const res = await fetch("/api/speech/transcribe", {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "음성을 알아듣지 못했어요.");
      setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "음성을 알아듣지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{session.book_title}</h1>
          <p className="text-xs text-soft">
            {STAGE_LABELS[stageForQuestionIndex(Math.min(answeredCount, TOTAL_QUESTIONS - 1))]} ·{" "}
            {Math.min(answeredCount, TOTAL_QUESTIONS)}/{TOTAL_QUESTIONS} 질문
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={cancelSession} disabled={cancelling} className="btn-pill">
            취소
          </button>
          <button type="button" onClick={() => router.push("/home")} disabled={cancelling} className="btn-pill">
            다음에 작성
          </button>
        </div>
      </div>

      {bookContext !== undefined && (
        <div className="mb-3 text-xs text-soft">
          {bookContext ? (
            <>
              <button
                type="button"
                onClick={() => setShowBookContext((v) => !v)}
                className="font-semibold text-accent underline"
              >
                {showBookContext ? "책 정보 접기" : "📖 참고한 책 정보 보기"}
              </button>
              {showBookContext && <p className="mt-1 rounded-xl bg-[#f4f0e8] p-2">{bookContext}</p>}
            </>
          ) : (
            <p>ℹ️ 이 책 정보를 찾지 못해서 제목만으로 질문하고 있어요.</p>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl border-2 border-ink px-4 py-2 text-sm ${
              m.role === "assistant" ? "self-start bg-white" : "self-end bg-accent/15"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="self-start text-sm text-soft">...</div>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="여기에 답을 써줘"
          rows={2}
          className="input mb-0 flex-1"
        />
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          className={`mb-0 h-12 w-12 shrink-0 rounded-full border-2 border-ink text-xl ${
            recording ? "bg-red-400" : "bg-white"
          }`}
        >
          🎤
        </button>
        <button
          type="button"
          onClick={submitAnswer}
          disabled={loading || !input.trim()}
          className="btn btn-primary mb-0 w-auto shrink-0 px-5"
        >
          보내기
        </button>
      </div>
    </div>
  );
}
