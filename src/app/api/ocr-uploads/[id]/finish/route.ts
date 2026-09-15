import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireChildProfileForApi } from "@/lib/currentProfile";
import { demoBlockResponse } from "@/lib/demoMode";

// /read/ocr/[id]/review 페이지 자체가 자녀 전용(requireChildProfile)이라 이 라우트도 동일하게
// 막는다 — 세션/가족 소유권 확인은 기존대로 RLS(ocr_uploads_select, reading_records_insert)가 전담.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;
  const demoBlock = await demoBlockResponse(profile, "데모 체험 계정에서는 독서노트 사진 기록을 저장할 수 없어요.");
  if (demoBlock) return demoBlock;

  const supabase = createClient();
  const { bookTitle, content, recordedDate, pageCount } = await request.json();

  if (typeof bookTitle !== "string" || bookTitle.trim().length < 2) {
    return NextResponse.json({ error: "책 표지에 적힌 정확한 제목을 입력해주세요." }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  }
  // 도서 검색 API가 페이지 수를 제공하지 않아 항상 사람이 직접 입력한다(OcrReview.tsx 참고) —
  // 숫자를 잘못 지어내는 걸 막기 위해 서버에서도 양의 정수인지 다시 확인한다.
  if (typeof pageCount !== "number" || !Number.isInteger(pageCount) || pageCount <= 0) {
    return NextResponse.json({ error: "페이지 수를 숫자로 입력해주세요." }, { status: 400 });
  }

  const { data: upload, error: fetchError } = await supabase
    .from("ocr_uploads")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !upload) {
    return NextResponse.json({ error: "업로드를 찾을 수 없어요." }, { status: 404 });
  }

  const { data: record, error: insertError } = await supabase
    .from("reading_records")
    .insert({
      family_id: upload.family_id,
      child_profile_id: upload.child_profile_id,
      book_title: bookTitle.trim(),
      page_count: pageCount,
      source_type: "ocr",
      content: content.trim(),
      source_ref_id: upload.id,
      recorded_at: typeof recordedDate === "string" && recordedDate ? recordedDate : undefined,
    })
    .select()
    .single();

  if (insertError || !record) {
    return NextResponse.json({ error: "기록을 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recordId: record.id });
}
