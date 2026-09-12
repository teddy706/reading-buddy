import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { LogoutButton } from "@/components/LogoutButton";

export default async function SettingsPage() {
  await requireParentProfile();

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">부모 설정</h1>

      {/* 태블릿/PC 폭에서는 2열로 — 화면이 넓어질수록 카드가 세로로만 길게 늘어지지 않게 한다. */}
      <div className="md:grid md:grid-cols-2 md:gap-4">
        <Link href="/settings/stats" className="card block">
          <p className="font-bold">독서 통계</p>
          <p className="text-sm text-soft">월별 독서량 추이, 기록 방식, &apos;독서로&apos; 반영 현황을 한눈에 봐요</p>
        </Link>

        <Link href="/settings/badges" className="card block">
          <p className="font-bold">배지 비교</p>
          <p className="text-sm text-soft">두 자녀가 모은 배지를 나란히 비교해요</p>
        </Link>

        <Link href="/settings/records" className="card block">
          <p className="font-bold">자녀 독서 기록</p>
          <p className="text-sm text-soft">두 자녀의 기록 현황을 한눈에 보고 검토·수정해요</p>
        </Link>

        <Link href="/settings/children" className="card block">
          <p className="font-bold">자녀 프로필 관리</p>
          <p className="text-sm text-soft">이름, 아바타, PIN 재설정</p>
        </Link>

        <Link href="/settings/coach" className="card block md:col-span-2">
          <p className="font-bold">AI 질문 스타일</p>
          <p className="text-sm text-soft">대화할 때 AI가 참고하는 단계별 질문 지침을 우리 가족 스타일로 바꿔요</p>
        </Link>
      </div>

      <div className="mt-auto flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xs">
        <Link href="/profiles" className="btn btn-outline mb-0">
          프로필 선택으로
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
