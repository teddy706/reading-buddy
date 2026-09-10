"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewBookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
