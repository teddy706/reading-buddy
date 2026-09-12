import { notFound } from "next/navigation";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { OcrReview } from "@/components/OcrReview";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

export default async function OcrReviewPage({ params }: { params: { id: string } }) {
  await requireChildProfile();

  const supabase = createClient();
  const { data: upload } = await supabase.from("ocr_uploads").select("*").eq("id", params.id).maybeSingle();

  if (!upload) notFound();

  const { data: signed } = await supabase.storage.from("reading-notes").createSignedUrl(upload.image_path, 3600);

  const parsed = (upload.parsed_result ?? {}) as { bookTitle?: string; content?: string };

  return (
    <OcrReview
      uploadId={upload.id}
      imageUrl={signed?.signedUrl ?? null}
      failed={upload.status === "failed"}
      initialBookTitle={parsed.bookTitle ?? ""}
      initialContent={parsed.content ?? upload.raw_text ?? ""}
    />
  );
}
