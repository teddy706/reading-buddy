"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface BookCandidate {
  title: string;
  author: string | null;
  thumbnail: string | null;
  description: string | null;
}

export function NewBookForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [candidates, setCandidates] = useState<BookCandidate[] | null>(null);

  async function onCoverPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setCandidates(null);
    setLookupLoading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/book-cover-lookup", { method: "POST", body: formData });
      const data = await res.json();
      const found = (data.candidates ?? []) as BookCandidate[];
      if (found.length === 0) {
        setError("표지에서 책을 찾지 못했어요. 제목을 직접 입력해주세요.");
      }
      setCandidates(found);
    } catch {
      setError("표지 검색에 실패했어요. 제목을 직접 입력해주세요.");
    } finally {
      setLookupLoading(false);
    }
  }

  function onPickCandidate(candidate: BookCandidate) {
    setTitle(candidate.title);
    setAuthor(candidate.author ?? "");
    setCandidates(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
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

      const { data: session, error: insertError } = await supabase
        .from("conversation_sessions")
        .insert({
          family_id: profile.family_id,
          child_profile_id: profile.id,
          book_title: title.trim(),
          book_author: author.trim() || null,
        })
        .select()
        .single();

      if (insertError || !session) throw new Error("대화를 시작하지 못했어요.");

      router.push(`/read/${session.id}/chat`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화를 시작하지 못했어요.");
      setLoading(false);
    }
  }

  return (
    <div className="app-shell justify-center">
      <h1 className="mb-6 text-center text-2xl font-bold">무슨 책 읽었어?</h1>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCoverPhotoSelected}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lookupLoading}
        className="btn btn-outline"
      >
        {lookupLoading ? "표지를 찾는 중..." : "📷 표지 사진으로 찾기"}
      </button>

      {candidates && candidates.length > 0 && (
        <div className="card">
          <p className="mb-3 text-sm font-semibold text-soft">이 중에 있어?</p>
          {candidates.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPickCandidate(c)}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border-2 border-[#eee] p-2.5 text-left last:mb-0 hover:border-ink"
            >
              {c.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnail} alt="" className="h-14 w-10 rounded object-cover" />
              ) : (
                <span className="flex h-14 w-10 items-center justify-center rounded bg-[#f4f0e8] text-lg">📖</span>
              )}
              <span>
                <span className="block text-sm font-bold">{c.title}</span>
                {c.author && <span className="block text-xs text-soft">{c.author}</span>}
              </span>
            </button>
          ))}
          <button type="button" onClick={() => setCandidates(null)} className="btn btn-ghost mb-0">
            아니야, 직접 입력할래
          </button>
        </div>
      )}

      <form className="card" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="책 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="input"
        />
        <input
          type="text"
          placeholder="지은이 (몰라도 괜찮아요)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="input"
        />
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading}>
          {loading ? "시작하는 중..." : "이야기 시작하기"}
        </button>
      </form>
    </div>
  );
}
