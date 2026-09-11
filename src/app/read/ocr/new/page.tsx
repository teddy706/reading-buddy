import { requireChildProfile } from "@/lib/currentProfile";
import { NewOcrForm } from "@/components/NewOcrForm";

// /read/new/book과 동일한 이유로 여기서도 직접 자녀 세션인지 확인한다(NewBookPage 주석 참고).
export default async function NewOcrPage() {
  await requireChildProfile();
  return <NewOcrForm />;
}
