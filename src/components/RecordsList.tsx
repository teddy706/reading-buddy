"use client";

import { useMemo, useState } from "react";
import { RecordCard } from "@/components/RecordCard";
import type { ReadingRecord } from "@/lib/types";

// 기록이 많아져도 서버 쪽 페이지네이션은 아직 없다 — 가족용 앱 특성상 수백 건 단위까지
// 갈 일은 드물어서, 지금은 서버가 전체를 한 번에 내려주고 화면에서 검색어로 걸러내는
// 방식으로 충분하다고 판단(클라이언트 필터라 네트워크 왕복 없이 즉시 반응).
export function RecordsList({ records }: { records: ReadingRecord[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) => r.book_title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
    );
  }, [records, query]);

  if (records.length === 0) {
    return <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>;
  }

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="책 제목이나 내용으로 검색"
        className="input"
      />

      {filtered.length === 0 ? (
        <div className="card text-center text-sm text-soft">검색 결과가 없어요.</div>
      ) : (
        filtered.map((r) => <RecordCard key={r.id} record={r} />)
      )}
    </>
  );
}
