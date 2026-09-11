import { requireChildProfile } from "@/lib/currentProfile";
import { NewBookForm } from "@/components/NewBookForm";

// 이 화면 자체는(부모가 URL을 직접 열어도 접근되던 예전 방식과 달리) 항상 자녀 세션만 들어올 수
// 있게 서버에서 한 번 더 막는다 — /read/new(선택 화면)의 requireChildProfile()은 이 페이지로
// 직접 이동하면 우회되기 때문에, 표지 촬영 자동 인식 등 이 화면의 기능이 항상 자녀 전용으로
// 남도록 여기서도 동일하게 확인한다.
export default async function NewBookPage() {
  await requireChildProfile();
  return <NewBookForm />;
}
