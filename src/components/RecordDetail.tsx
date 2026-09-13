"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { DokseoroStatusBadge } from "@/components/DokseoroStatusBadge";
import { naverBookSearchUrl } from "@/lib/externalBookSearch";
import { normalizeIsbnInput } from "@/lib/isbn";
import type { ConversationMessage, ReadingRecord } from "@/lib/types";

const SOURCE_LABEL: Record<ReadingRecord["source_type"], string> = {
  conversation: "💬 대화로 기록",
  ocr: "📷 독서노트 사진으로 기록",
  manual: "✏️ 직접 입력",
};

const DOKSEORO_URL = "https://read365.edunet.net/";

export function RecordDetail({
  record,
  childName,
  childAvatar,
  childAvatarPhotoUrl,
  conversationMessages,
  canManageDokseoro,
  backHref,
}: {
  record: ReadingRecord;
  childName: string | null;
  childAvatar: string | null;
  childAvatarPhotoUrl?: string | null;
  conversationMessages?: ConversationMessage[] | null;
  // '독서로' 실제 등록은 부모가 그 사이트에 로그인해서 하는 일이라, "등록했어요" 상태 전환도
  // 부모만 할 수 있게 한다 — 서버(reading-records PATCH)도 같은 규칙을 강제한다.
  canManageDokseoro: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [bookTitle, setBookTitle] = useState(record.book_title);
  const [pageCount, setPageCount] = useState(record.page_count != null ? String(record.page_count) : "");
  // 생기부 독서활동상황란은 ISBN에 등재된 도서에 한해 기재 가능하다는 교육부 지침에 따라
  // 추가 — 자동완성/표지 인식으로 고른 기록은 자동으로 채워져 있고, 그 외(직접 입력/OCR)는
  // 비어 있을 수 있어 여기서 나중에 채워 넣을 수 있다(페이지 수와 동일한 패턴).
  const [isbn, setIsbn] = useState(record.isbn ?? "");
  const [recordedDate, setRecordedDate] = useState(record.recorded_at);
  const [content, setContent] = useState(record.content);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dokseoroStatus, setDokseoroStatus] = useState(record.dokseoro_status);
  const [copied, setCopied] = useState(false);
  const [markingStatus, setMarkingStatus] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const childAnswerCount = (conversationMessages ?? []).filter((m) => m.role === "child").length;

  const dirty =
    bookTitle !== record.book_title ||
    pageCount !== (record.page_count != null ? String(record.page_count) : "") ||
    isbn !== (record.isbn ?? "") ||
    recordedDate !== record.recorded_at ||
    content !== record.content;

  async function patchRecord(body: Record<string, unknown>) {
    const res = await fetch(`/api/reading-records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "저장하지 못했어요.");
  }

  // 페이지 수는 도서 검색 API가 제공하지 않아 항상 사람이 직접 입력한다 — 빈 문자열이면
  // "아직 안 채움"으로 보고 그대로 두고(기존 기록을 억지로 채우게 강제하지 않음), 값이 있으면
  // 양의 정수인지 확인한다.
  function parsePageCountInput(): number | undefined {
    if (!pageCount.trim()) return undefined;
    const parsed = Number(pageCount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("페이지 수는 1 이상의 숫자로 입력해주세요.");
    }
    return parsed;
  }

  // ISBN도 페이지 수와 같은 원칙 — 비어 있으면 그대로 두고(강제하지 않음), 값이 있으면
  // 10자리 또는 13자리 형식인지만 확인한다(체크섬까지는 검증하지 않음).
  function parseIsbnInput(): string | undefined {
    if (!isbn.trim()) return undefined;
    const normalized = normalizeIsbnInput(isbn);
    if (!normalized) {
      throw new Error("ISBN은 10자리 또는 13자리 숫자로 입력해주세요.");
    }
    return normalized;
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const parsedPageCount = parsePageCountInput();
      const parsedIsbn = parseIsbnInput();
      await patchRecord({
        bookTitle,
        content,
        recordedDate,
        ...(parsedPageCount !== undefined ? { pageCount: parsedPageCount } : {}),
        ...(parsedIsbn !== undefined ? { isbn: parsedIsbn } : {}),
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function onMarkDokseoro(next: "synced" | "pending") {
    setMarkingStatus(true);
    setError(null);
    try {
      // 상태와 함께 현재 화면에 있는 최신 내용도 같이 저장해서, "등록 완료"로 표시한 시점의
      // 내용과 실제로 복사해 붙여넣은 내용이 어긋나지 않게 한다.
      const parsedPageCount = parsePageCountInput();
      const parsedIsbn = parseIsbnInput();
      await patchRecord({
        bookTitle,
        content,
        recordedDate,
        dokseoroStatus: next,
        ...(parsedPageCount !== undefined ? { pageCount: parsedPageCount } : {}),
        ...(parsedIsbn !== undefined ? { isbn: parsedIsbn } : {}),
      });
      setDokseoroStatus(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태를 바꾸지 못했어요.");
    } finally {
      setMarkingStatus(false);
    }
  }

  async function onCopyAll() {
    const text = [
      `책 제목: ${bookTitle}`,
      record.book_author ? `저자: ${record.book_author}` : null,
      pageCount.trim() ? `페이지 수: ${pageCount.trim()}쪽` : null,
      isbn.trim() ? `ISBN: ${isbn.trim()}` : null,
      `읽은 날짜: ${recordedDate}`,
      "",
      content,
    ]
      .filter((line) => line !== null)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("복사하지 못했어요. 직접 선택해서 복사해주세요.");
    }
  }

  return (
    <div className="app-shell">
      <div className="mx-auto w-full max-w-xl">
      <BackLink href={backHref} />

      {childName && (
        <div className="mb-4 flex items-center gap-2">
          {childAvatar && <Avatar emoji={childAvatar} photoUrl={childAvatarPhotoUrl} size="sm" />}
          <span className="text-sm font-semibold text-soft">{childName}의 기록</span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm text-soft">{SOURCE_LABEL[record.source_type]}</span>
        <DokseoroStatusBadge status={dokseoroStatus} />
      </div>

      <label className="mb-1 text-sm font-semibold text-soft">책 제목</label>
      <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} className="input" />

      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-semibold text-soft">책 페이지 수</label>
        {bookTitle.trim() && (
          <a
            href={naverBookSearchUrl(bookTitle, record.book_author)}
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
        className="input"
      />

      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-semibold text-soft">ISBN (선택)</label>
        {bookTitle.trim() && (
          <a
            href={naverBookSearchUrl(bookTitle, record.book_author)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-accent underline"
          >
            🔍 찾아보기
          </a>
        )}
      </div>
      {/* 생기부 독서활동상황란은 ISBN에 등재된 도서에 한해 책 제목/저자를 기재할 수 있다는
          교육부 지침에 따라 추가 — 자동완성/표지 인식으로 고른 기록은 이미 채워져 있고,
          그 외(직접 입력·OCR)는 비어 있을 수 있어 나중에 채워 넣을 수 있게 편집 가능하게 둔다. */}
      <input
        value={isbn}
        onChange={(e) => setIsbn(e.target.value)}
        placeholder="예: 9788983920770 (책 뒤표지 바코드 위 숫자)"
        className="input"
      />

      <label className="mb-1 text-sm font-semibold text-soft">읽은 날짜</label>
      <input type="date" value={recordedDate} onChange={(e) => setRecordedDate(e.target.value)} className="input" />

      <label className="mb-1 text-sm font-semibold text-soft">
        내용{record.source_type === "conversation" && <span className="font-normal text-soft"> · 🤖 AI가 정리한 감상문</span>}
      </label>
      {record.source_type === "conversation" && childAnswerCount > 0 && (
        <p className="mb-1 text-xs text-soft">
          아이의 답변을 바탕으로 AI가 문장을 다듬어 정리했어요. 아이가 실제로 한 말은 아래에서 확인할 수 있어요.
        </p>
      )}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input" />

      {childAnswerCount > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="text-left text-sm font-semibold text-accent underline"
          >
            {showTranscript ? "아이가 답변한 원본 대화 접기" : `🗣️ 아이가 답변한 원본 대화 보기 (${childAnswerCount}개)`}
          </button>
          {showTranscript && (
            <div className="card mt-2">
              <p className="mb-2 text-xs font-semibold text-soft">
                위 감상문은 AI가 다듬은 결과예요. 아래는 아이가 실제로 한 말 그대로예요.
              </p>
              {(conversationMessages ?? []).map((m, i) => (
                <p key={i} className={`mb-2 text-sm ${m.role === "child" ? "font-semibold" : "text-soft"}`}>
                  {m.role === "child" ? "🗣️ 아이: " : "🤖 질문: "}
                  {m.content}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
      {saved && <p className="mb-2 text-sm font-semibold text-a">저장했어요!</p>}

      <button type="button" onClick={onSave} disabled={!dirty || saving} className="btn btn-primary mb-3">
        {saving ? "저장하는 중..." : "저장"}
      </button>

      <div className="card">
        <p className="mb-1 font-bold">&apos;독서로&apos;에 등록하기</p>
        <p className="mb-3 text-sm text-soft">
          아직 자동으로 등록해주지는 못해요. 아래 내용을 복사해서 &apos;독서로&apos;에 직접 붙여넣어주세요.
        </p>

        <button type="button" onClick={onCopyAll} className="btn btn-outline mb-2">
          {copied ? "복사했어요!" : "📋 내용 전체 복사하기"}
        </button>

        <a href={DOKSEORO_URL} target="_blank" rel="noreferrer" className="btn btn-outline mb-3">
          &apos;독서로&apos; 사이트 열기 ↗
        </a>

        {canManageDokseoro ? (
          dokseoroStatus === "synced" ? (
            <button
              type="button"
              onClick={() => onMarkDokseoro("pending")}
              disabled={markingStatus}
              className="btn btn-ghost mb-0"
            >
              등록 취소로 되돌리기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMarkDokseoro("synced")}
              disabled={markingStatus}
              className="btn btn-primary mb-0"
            >
              {markingStatus ? "저장하는 중..." : "✅ '독서로'에 등록했어요"}
            </button>
          )
        ) : (
          <p className="text-xs text-soft">등록 완료 표시는 부모님만 바꿀 수 있어요.</p>
        )}
      </div>
      </div>
    </div>
  );
}
