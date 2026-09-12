import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/currentProfile";
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
  const { bookTitle, content, recordedDate, dokseoroStatus } = await request.json();

  if (dokseoroStatus !== undefined && profile.role !== "parent") {
    return NextResponse.json({ error: "'독서로' 등록 상태는 부모만 바꿀 수 있어요." }, { status: 403 });
  }

  const update: {
    book_title?: string;
    content?: string;
    recorded_at?: string;
    dokseoro_status?: DokseoroStatus;
  } = {};
  if (typeof bookTitle === "string" && bookTitle.trim()) update.book_title = bookTitle.trim();
  if (typeof content === "string" && content.trim()) update.content = content.trim();
  if (typeof recordedDate === "string" && recordedDate) update.recorded_at = recordedDate;
  if (DOKSEORO_STATUSES.includes(dokseoroStatus)) update.dokseoro_status = dokseoroStatus;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const { error } = await supabase.from("reading_records").update(update).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
