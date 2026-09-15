import { redirect } from "next/navigation";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { isDemoFamily } from "@/lib/demoMode";
import { NewOcrForm } from "@/components/NewOcrForm";

// /read/new/book과 동일한 이유로 여기서도 직접 자녀 세션인지 확인한다(NewBookPage 주석 참고).
export default async function NewOcrPage() {
  const child = await requireChildProfile();
  // OCR은 데모 계정에서 막혀 있다(/read/new에서 카드 자체를 비활성화) — URL을 직접 열어도
  // 같은 규칙이 적용되도록 여기서도 한 번 더 확인한다.
  if (await isDemoFamily(child.family_id, createClient())) redirect("/read/new");
  return <NewOcrForm />;
}
