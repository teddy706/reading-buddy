import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/currentProfile";
import { normalizeIsbnInput } from "@/lib/isbn";
import type { DokseoroStatus } from "@/lib/types";

const DOKSEORO_STATUSES: DokseoroStatus[] = ["pending", "synced", "failed"];

// 자녀(본인 기록만) 또는 부모(가족 내 모든 기록)가 책 제목/날짜/내용을 고칠 수 있다(PRD 5.2(5)
// "부모의 기록 검토 및 수정 권한"). 소유권 확인은 reading_records_update RLS 정책이 전담한다.
// dokseoroStatus는 자동 연동이 아직 없어(Phase 1 "4. 독서로 자동 연동" 참고), '독서로'에 수동으로
// 등록한 뒤 "등록 완료"로 표시하는 용도로 쓴다 — 실제로 '독서로' 사이트에 로그인해서 등록하는 건
// 부모의 몫이라, 이 상태 변경은 부모만 할 수 있게 막는다(RLS는 가족/본인 여부만 가리고 역할별
// 필드 제한은 못 하므로, 그 부분은 이 라우트가 직접 확인한다).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const supabase = createClient();
  const { bookTitle, content, recordedDate, dokseoroStatus, pageCount, isbn } = await request.json();

  if (dokseoroStatus !== undefined && profile.role !== "parent") {
    return NextResponse.json({ error: "'독서로' 등록 상태는 부모만 바꿀 수 있어요." }, { status: 403 });
  }
  // 페이지 수는 도서 검색 API가 제공하지 않아 항상 사람이 직접 입력한다 — 값을 보냈다면
  // 양의 정수인지 서버에서도 다시 확인한다(빈 값/undefined면 그냥 건드리지 않고 넘어감).
  if (pageCount !== undefined && (typeof pageCount !== "number" || !Number.isInteger(pageCount) || pageCount <= 0)) {
    return NextResponse.json({ error: "페이지 수는 1 이상의 숫자여야 해요." }, { status: 400 });
  }
  // ISBN도 마찬가지로 서버에서 다시 정규화·검증한다(생기부 독서활동 등재에는 ISBN에 등재된
  // 도서만 가능하다는 교육부 지침 참고 — CLAUDE.md).
  const normalizedIsbn = typeof isbn === "string" && isbn.trim() ? normalizeIsbnInput(isbn) : undefined;
  if (typeof isbn === "string" && isbn.trim() && !normalizedIsbn) {
    return NextResponse.json({ error: "ISBN은 10자리 또는 13자리 숫자여야 해요." }, { status: 400 });
  }

  const update: {
    book_title?: string;
    content?: string;
    recorded_at?: string;
    dokseoro_status?: DokseoroStatus;
    page_count?: number;
    isbn?: string;
  } = {};
  if (typeof bookTitle === "string" && bookTitle.trim()) update.book_title = bookTitle.trim();
  if (typeof content === "string" && content.trim()) update.content = content.trim();
  if (typeof recordedDate === "string" && recordedDate) update.recorded_at = recordedDate;
  if (DOKSEORO_STATUSES.includes(dokseoroStatus)) update.dokseoro_status = dokseoroStatus;
  if (typeof pageCount === "number") update.page_count = pageCount;
  if (normalizedIsbn) update.isbn = normalizedIsbn;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const { error } = await supabase.from("reading_records").update(update).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
