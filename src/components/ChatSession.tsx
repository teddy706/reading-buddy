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
    } catch (err) {
      setError(err instanceof Error ? err.message : "문제가 생겼어요.");
    } finally {
      setLoading(false);
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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{session.book_title}</h1>
          <p className="text-xs text-soft">
            {STAGE_LABELS[stageForQuestionIndex(Math.min(answeredCount, TOTAL_QUESTIONS - 1))]} ·{" "}
            {Math.min(answeredCount, TOTAL_QUESTIONS)}/{TOTAL_QUESTIONS} 질문
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/read/${session.id}/review`)}
          disabled={answeredCount === 0}
          className="btn btn-ghost mb-0"
        >
          그만할래
        </button>
      </div>

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
