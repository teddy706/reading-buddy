import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { bookTitle, content, recordedDate } = await request.json();

  if (typeof bookTitle !== "string" || !bookTitle.trim()) {
    return NextResponse.json({ error: "책 제목을 입력해주세요." }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
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
