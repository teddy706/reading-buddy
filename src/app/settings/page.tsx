import Link from "next/link";
import { requireParentProfile } from "@/lib/currentProfile";
import { LogoutButton } from "@/components/LogoutButton";

export default async function SettingsPage() {
  await requireParentProfile();

  return (
    <div className="app-shell">
      <h1 className="mb-6 text-center text-2xl font-bold">부모 설정</h1>

      <Link href="/settings/children" className="card block">
        <p className="font-bold">자녀 프로필 관리</p>
        <p className="text-sm text-soft">이름, 아바타, PIN 재설정</p>
      </Link>

      <div className="mt-auto flex flex-col gap-2">
        <Link href="/profiles" className="btn btn-outline mb-0">
          프로필 선택으로
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
