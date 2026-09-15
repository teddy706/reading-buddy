"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BookCandidate } from "@/lib/kakaoBook";
import { naverBookSearchUrl } from "@/lib/externalBookSearch";

// 타이핑하다 멈추고 이 정도는 지나야 검색하는 디바운스 시간. 너무 짧으면 한 글자마다 검색이
// 나가고, 초등 3학년이 천천히/서투르게 타이핑할 수 있어서 넉넉하게 잡았다.
const TITLE_SEARCH_DEBOUNCE_MS = 500;
const MIN_TITLE_SEARCH_LENGTH = 2;

export function NewBookForm({ isDemo = false }: { isDemo?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  // 총 페이지 수 — 카카오/도서관정보나루 검색 API 둘 다 페이지 수를 제공하지 않아서 자동으로
  // 채울 수 없다. 책 표지/뒷면에 적힌 숫자를 아이/부모가 직접 입력한다(문자열로 들고 있다가
  // 제출 시 정수로 변환·검증).
  const [pageCount, setPageCount] = useState("");
  // 검색 후보를 골랐을 때만 채워진다(생기부 독서활동 등재는 ISBN에 등재된 도서만 가능하다는
  // 교육부 지침 참고) — 직접 타이핑한 제목은 어느 판본인지 특정할 수 없어 비워둔다. 후보를
  // 고른 뒤에 제목을 직접 고쳐 쓰면(더는 그 후보가 아니게 되므로) 비워서 잘못된 ISBN이
  // 다른 책에 붙는 걸 막는다.
  const [isbn, setIsbn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [candidates, setCandidates] = useState<BookCandidate[] | null>(null);
  // 책 제목 입력창 자동완성 — 정확한 제목은 카카오 검색 결과에서 직접 고르게 하고, 못 찾으면
  // 지금까지처럼 직접 입력한 텍스트로도 그냥 진행할 수 있게 둔다(카카오에 없는 책도 있으므로).
  const [titleSuggestions, setTitleSuggestions] = useState<BookCandidate[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  // 검색이 실제로 끝난 검색어 — 결과가 0건일 때 "검색 중"과 "찾아봤지만 없음"을 구분해서
  // 보여주는 데 쓴다(그림책/동화책은 카카오 도서 검색에 잘 안 걸리는 경우가 많아서, 없어도
  // 당황하지 않고 직접 입력으로 진행하면 된다는 걸 분명히 알려주기 위함).
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string | null>(null);
  // 후보를 골라서 title을 프로그램적으로 채운 직후엔, 같은 값으로 다시 검색해서 방금 접은
  // 목록이 곧바로 다시 뜨는 걸 막는다.
  const skipNextTitleSearchRef = useRef(false);
  // 검색 결과가 0건이면 서버가 AI 오타 교정까지 시도하느라 그 요청만 유독 느려질 수 있다
  // (book-search route 참고). 그사이 아이가 계속 타이핑해서 더 최신 검색이 먼저 끝나면,
  // 늦게 도착한 옛 응답이 최신 결과를 덮어쓰지 않도록 "가장 최근에 보낸 검색어"만 반영한다.
  const latestQueryRef = useRef("");

  useEffect(() => {
    if (skipNextTitleSearchRef.current) {
      skipNextTitleSearchRef.current = false;
      return;
    }
    const query = title.trim();
    if (query.length < MIN_TITLE_SEARCH_LENGTH) {
      setTitleSuggestions([]);
      setLastSearchedQuery(null);
      return;
    }
    const timer = setTimeout(async () => {
      latestQueryRef.current = query;
      try {
        const res = await fetch(`/api/book-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (latestQueryRef.current !== query) return;
        setTitleSuggestions((data.candidates ?? []) as BookCandidate[]);
      } catch {
        if (latestQueryRef.current !== query) return;
        setTitleSuggestions([]);
      } finally {
        if (latestQueryRef.current === query) setLastSearchedQuery(query);
      }
    }, TITLE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title]);

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
    skipNextTitleSearchRef.current = true;
    setTitle(candidate.title);
    setAuthor(candidate.author ?? "");
    setIsbn(candidate.isbn);
    setCandidates(null);
    setTitleSuggestions([]);
  }

  function onPickTitleSuggestion(candidate: BookCandidate) {
    skipNextTitleSearchRef.current = true;
    setTitle(candidate.title);
    setAuthor(candidate.author ?? "");
    setIsbn(candidate.isbn);
    setTitleSuggestions([]);
    setShowTitleSuggestions(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const trimmedTitle = title.trim();
    // 표지에 적힌 실제 제목과 다른 짧은 낱말(예: 장르명, 한 글자)을 실수로 넣는 걸 막기 위한
    // 최소한의 검증 — 검색 자동완성에서 정확한 제목을 고르는 기존 경로는 그대로 두고, 직접
    // 입력하는 경우에도 최소한의 형태는 갖추도록 한다.
    if (trimmedTitle.length < 2) {
      setError("책 표지에 적힌 정확한 제목을 입력해줘.");
      return;
    }
    const parsedPageCount = Number(pageCount);
    if (!pageCount.trim() || !Number.isInteger(parsedPageCount) || parsedPageCount <= 0) {
      setError("책 뒷면이나 마지막 쪽에 적힌 페이지 수를 숫자로 입력해줘.");
      return;
    }
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
          book_title: trimmedTitle,
          book_author: author.trim() || null,
          book_page_count: parsedPageCount,
          book_isbn: isbn,
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
      {/* 자동완성 드롭다운이 이 컨테이너 폭 기준으로 펼쳐지므로, 넓은 화면에서도 모바일과
          비슷한 폭으로 고정해 레이아웃이 흐트러지지 않게 한다. */}
      <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-center text-2xl font-bold">무슨 책 읽었어?</h1>

      {/* 표지 촬영 자동 인식은 Document Intelligence + AI 실제 호출 비용이 들어서 데모
          계정에서는 막아둔다(demoMode.ts) — 대화 체험만 허용하기로 확인됨. */}
      {!isDemo && (
        <>
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
        </>
      )}

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
        <div className="relative">
          <input
            type="text"
            placeholder="책 제목 (표지에 적힌 그대로)"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              // 후보를 고른 뒤 제목을 손으로 고치면 더는 그 후보가 아니므로, 엉뚱한 책에
              // ISBN이 붙어있지 않게 비운다.
              setIsbn(null);
            }}
            onFocus={() => setShowTitleSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 150)}
            required
            autoComplete="off"
            className="input"
          />
          {showTitleSuggestions && titleSuggestions.length > 0 && (
            <div className="absolute inset-x-0 top-full z-10 -mt-1 rounded-2xl border-2 border-ink bg-white p-2 shadow-card">
              <p className="mb-2 px-1 text-xs font-semibold text-soft">정확한 제목으로 찾았어요 — 골라볼래?</p>
              {titleSuggestions.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => onPickTitleSuggestion(c)}
                  className="mb-1 flex w-full items-center gap-3 rounded-2xl border-2 border-[#eee] p-2 text-left last:mb-0 hover:border-ink"
                >
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnail} alt="" className="h-12 w-9 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-9 items-center justify-center rounded bg-[#f4f0e8] text-base">📖</span>
                  )}
                  <span>
                    <span className="block text-sm font-bold">{c.title}</span>
                    {c.author && <span className="block text-xs text-soft">{c.author}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          {showTitleSuggestions &&
            titleSuggestions.length === 0 &&
            lastSearchedQuery === title.trim() && (
              <div className="absolute inset-x-0 top-full z-10 -mt-1 rounded-2xl border-2 border-ink bg-white p-3 shadow-card">
                <p className="text-xs text-soft">
                  검색에서 이 책을 찾지 못했어요. 그림책·동화책은 검색에 잘 안 나오는 경우가 많아요
                  — 지금 입력한 제목으로 그대로 진행할 수 있어요.
                </p>
              </div>
            )}
        </div>
        <input
          type="text"
          placeholder="지은이 (몰라도 괜찮아요)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="input"
        />
        {isbn && (
          // 검색 결과에서 후보를 골랐을 때만 보인다 — 생기부 독서활동 등재에는 ISBN이
          // 등재된 도서만 가능해서, 확인됐다는 걸 미리 알려주면 부모가 안심할 수 있다.
          <p className="mb-2.5 -mt-1 text-xs text-soft">✅ ISBN 확인됨 ({isbn}) — 생기부 독서활동 등재에 활용할 수 있어요</p>
        )}
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-semibold text-soft">책 페이지 수 (책 뒷면·마지막 쪽에 있어요)</label>
          {title.trim() && (
            <a
              href={naverBookSearchUrl(title, author)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-accent underline"
            >
              🔍 찾아보기
            </a>
          )}
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="예: 132"
          value={pageCount}
          onChange={(e) => setPageCount(e.target.value)}
          required
          className="input"
        />
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading}>
          {loading ? "시작하는 중..." : "이야기 시작하기"}
        </button>
      </form>
      </div>
    </div>
  );
}
