"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { RecordsBrowser } from "@/components/RecordsBrowser";
import type { Profile, ReadingRecord } from "@/lib/types";

// 자녀가 늘어날수록(지금은 4명) 한 화면에 전부 세로로 나열하면 스크롤이 너무 길어진다는
// 피드백을 받고, 탭으로 한 명씩만 보여주도록 바꿨다. 서버 컴포넌트(page.tsx)가 모든 자녀의
// 첫 페이지를 이미 병렬로 받아왔으니 여기서는 탭 전환만 클라이언트에서 처리한다.
//
// 선택된 탭은 컴포넌트 로컬 state가 아니라 URL 쿼리 파라미터(?child=)로 관리한다 — 로컬
// state만 쓰면 이 화면을 벗어났다 돌아올 때(기록 상세로 들어갔다 "뒤로" 등) 서버 컴포넌트
// 페이지 자체가 다시 마운트되면서 항상 첫 번째 자녀 탭으로 리셋되는 문제가 있었다(2026-09-12
// 사용자 피드백: "선택된 상태로 유지되어야해"). 기록 상세 화면의 "뒤로" 링크(records/[id]/page.tsx)가
// 이 기록 주인의 child_profile_id를 쿼리로 넘겨주므로, 그 값을 초기 탭으로 읽어들이면 된다.
export function ChildRecordsTabs({
  childrenData,
}: {
  childrenData: {
    child: Profile;
    initialRecords: ReadingRecord[];
    totalCount: number;
    photoUrl: string | null;
  }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedId = searchParams.get("child");
  const initialId = childrenData.some((c) => c.child.id === requestedId) ? requestedId! : childrenData[0]?.child.id;
  const [activeId, setActiveId] = useState(initialId);
  const active = childrenData.find((c) => c.child.id === activeId) ?? childrenData[0];

  function onSelect(childId: string) {
    setActiveId(childId);
    router.replace(`${pathname}?child=${childId}`, { scroll: false });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {childrenData.map(({ child, totalCount, photoUrl }) => (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelect(child.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-bold transition-transform active:scale-95 ${
              child.id === active.child.id ? "bg-accent text-white" : "bg-white"
            }`}
          >
            <Avatar emoji={child.avatar} photoUrl={photoUrl} size="sm" />
            {child.name}
            <span className={child.id === active.child.id ? "font-normal text-white/80" : "font-normal text-soft"}>
              · {totalCount}권
            </span>
          </button>
        ))}
      </div>

      {/* key로 강제 리마운트: 탭을 바꾸면 검색어/스크롤 페이지 등 이전 자녀의 상태가
          그대로 남지 않고 새 initialRecords로 깨끗하게 시작한다. */}
      <RecordsBrowser key={active.child.id} childId={active.child.id} initialRecords={active.initialRecords} layout="grid" />
    </div>
  );
}
