import { requireChildProfile } from "@/lib/currentProfile";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";

export default async function HomePage() {
  const child = await requireChildProfile();

  return (
    <div className="app-shell">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar emoji={child.avatar} />
          <h1 className="text-xl font-bold">{child.name}의 책장</h1>
        </div>
        <LogoutButton label="나가기" />
      </div>

      <button type="button" disabled className="btn btn-primary">
        📖 새 기록 시작 (다음 단계에서 열려요)
      </button>

      <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>
    </div>
  );
}
