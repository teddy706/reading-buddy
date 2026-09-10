import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";

export default async function NewRecordPage() {
  await requireChildProfile();

  return (
    <div className="app-shell justify-center">
      <h1 className="mb-6 text-center text-2xl font-bold">어떻게 기록할까요?</h1>

      <Link href="/read/new/book" className="card block text-center">
        <div className="mb-2 text-4xl">💬</div>
        <p className="font-bold">대화로 기록하기</p>
        <p className="text-sm text-soft">질문에 답하면서 감상문을 만들어요</p>
      </Link>

      <div className="card block text-center opacity-50">
        <div className="mb-2 text-4xl">📷</div>
        <p className="font-bold">독서노트 사진으로 기록하기</p>
        <p className="text-sm text-soft">다음 업데이트에서 열려요</p>
      </div>

      <Link href="/home" className="btn btn-ghost mt-auto mb-0">
        뒤로
      </Link>
    </div>
  );
}
