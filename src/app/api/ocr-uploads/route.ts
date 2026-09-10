import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/currentProfile";
import { analyzeImage } from "@/lib/documentIntelligence";
import { parseOcrRecord } from "@/lib/azureOpenAI";

// 클라이언트가 'reading-notes' 버킷에 사진을 먼저 올린 뒤, 그 경로로 이 라우트를 호출한다.
// OCR 인식이 실패해도(손글씨를 못 읽거나 서비스 오류) 에러를 던지지 않고 status: 'failed'로
// 기록만 남긴다 — 확인/수정 화면은 실패해도 빈 칸으로 열려서 "직접 입력" 경로를 그대로 제공한다.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { imagePath } = await request.json();
  if (typeof imagePath !== "string" || !imagePath) {
    return NextResponse.json({ error: "사진 정보가 없어요." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: upload, error: insertError } = await supabase
    .from("ocr_uploads")
    .insert({
      family_id: profile.family_id,
      child_profile_id: profile.id,
      image_path: imagePath,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !upload) {
    return NextResponse.json({ error: "업로드를 기록하지 못했어요." }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from("reading-notes").createSignedUrl(imagePath, 300);

  if (!signed?.signedUrl) {
    await supabase.from("ocr_uploads").update({ status: "failed" }).eq("id", upload.id);
    return NextResponse.json({ id: upload.id });
  }

  try {
    const rawText = await analyzeImage(signed.signedUrl);
    const parsed = await parseOcrRecord(rawText);
    await supabase
      .from("ocr_uploads")
      .update({ raw_text: rawText, parsed_result: parsed, status: "processed" })
      .eq("id", upload.id);
  } catch {
    await supabase.from("ocr_uploads").update({ status: "failed" }).eq("id", upload.id);
  }

  return NextResponse.json({ id: upload.id });
}
