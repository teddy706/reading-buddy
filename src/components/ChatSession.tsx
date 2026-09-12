"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TOTAL_QUESTIONS, STAGE_LABELS, stageForQuestionIndex } from "@/lib/readingSession";
import { startPcmRecording, type PcmRecorder } from "@/lib/pcmRecorder";
import type { ConversationMessage, ConversationSession } from "@/lib/types";

const WAV_CONTENT_TYPE = "audio/wav; codecs=audio/pcm; samplerate=16000";

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
  // 서버(next-question 라우트)가 계산해 돌려주는 "계획된 질문" 기준 진행률 — 답이 너무 짧아
  // 팔로업 질문이 끼어드는 동안은 늘지 않고 그대로 유지된다.
  const [progress, setProgress] = useState({ current: 0, total: TOTAL_QUESTIONS });
  const pcmRecorderRef = useRef<PcmRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const answeredCount = messages.filter((m) => m.role === "child").length;
  const latestMessage = messages[messages.length - 1];
  const latestIsFollowUp = latestMessage?.role === "assistant" && latestMessage.isFollowUp === true;

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
      if (data.progress) setProgress(data.progress);
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
      micStreamRef.current = stream;
      pcmRecorderRef.current = startPcmRecording(stream);
      setRecording(true);
    } catch {
      setError("마이크를 사용할 수 없어요. 글자로 답해줘도 괜찮아요.");
    }
  }

  async function stopRecording() {
    const recorder = pcmRecorderRef.current;
    const stream = micStreamRef.current;
    pcmRecorderRef.current = null;
    micStreamRef.current = null;
    setRecording(false);
    if (!recorder) return;
    const blob = recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    await transcribe(blob);
  }

  async function transcribe(blob: Blob) {
    setLoading(true);
    try {
      const res = await fetch("/api/speech/transcribe", {
        method: "POST",
        headers: { "Content-Type": WAV_CONTENT_TYPE },
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
      {/* 채팅 UI는 메시지 폭이 너무 넓어지면 오히려 읽기 불편해서, 넓은 화면에서도 대화창
          자체는 적당한 폭(모바일보다 조금 더 넓은 정도)으로 가운데 고정한다. flex-1로
          바깥 shell의 남은 세로 공간을 그대로 이어받아 메시지 영역 스크롤이 정상 동작한다. */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{session.book_title}</h1>
          <p className="text-xs text-soft">
            {STAGE_LABELS[stageForQuestionIndex(Math.min(progress.current, TOTAL_QUESTIONS - 1))]} ·{" "}
            {progress.current}/{progress.total} 질문
            {latestIsFollowUp && " · 조금 더 자세히 들려줄래?"}
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
    </div>
  );
}
