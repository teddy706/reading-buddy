import Link from "next/link";
import { requireChildProfile } from "@/lib/currentProfile";
import { BackLink } from "@/components/BackLink";

export default async function NewRecordPage() {
  await requireChildProfile();

  return (
    <div className="app-shell justify-center">
      <div className="mx-auto w-full max-w-md md:max-w-2xl">
        <BackLink href="/home" />
        <h1 className="mb-6 text-center text-2xl font-bold">어떻게 기록할까요?</h1>

        {/* md부터 두 선택지를 나란히 — 딱 두 개뿐이라 좌우로 놓으면 한눈에 비교하기 좋다. */}
        <div className="md:grid md:grid-cols-2 md:gap-4">
          <Link href="/read/new/book" className="card block text-center">
            <div className="mb-2 text-4xl">💬</div>
            <p className="font-bold">대화로 기록하기</p>
            <p className="text-sm text-soft">질문에 답하면서 감상문을 만들어요</p>
          </Link>

          <Link href="/read/ocr/new" className="card block text-center">
            <div className="mb-2 text-4xl">📷</div>
            <p className="font-bold">독서노트 사진으로 기록하기</p>
            <p className="text-sm text-soft">학교 독서노트를 사진으로 찍어요</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
