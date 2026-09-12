"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { RecordsBrowser } from "@/components/RecordsBrowser";
import type { Profile, ReadingRecord } from "@/lib/types";

// 자녀가 늘어날수록(지금은 4명) 한 화면에 전부 세로로 나열하면 스크롤이 너무 길어진다는
// 피드백을 받고, 탭으로 한 명씩만 보여주도록 바꿨다. 서버 컴포넌트(page.tsx)가 모든 자녀의
// 첫 페이지를 이미 병렬로 받아왔으니 여기서는 탭 전환만 클라이언트에서 처리한다.
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
  const [activeId, setActiveId] = useState(childrenData[0]?.child.id);
  const active = childrenData.find((c) => c.child.id === activeId) ?? childrenData[0];

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {childrenData.map(({ child, totalCount, photoUrl }) => (
          <button
            key={child.id}
            type="button"
            onClick={() => setActiveId(child.id)}
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
      <RecordsBrowser key={active.child.id} childId={active.child.id} initialRecords={active.initialRecords} />
    </div>
  );
}
