"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RecordCard } from "@/components/RecordCard";
import { RECORDS_PAGE_SIZE } from "@/lib/recordsPaging";
import type { ReadingRecord } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 400;

// ilike 패턴의 와일드카드(%, _)를 이스케이프하고, or() 필터 문법에서 값 구분자로 쓰이는
// 콤마와 충돌하지 않도록 큰따옴표로 감싼다(PostgREST or-filter 문법 — 콤마가 조건 구분자라
// 검색어에 콤마가 있으면 큰따옴표로 감싸지 않는 한 필터가 깨진다).
export function toIlikePattern(value: string): string {
  const escaped = value.replace(/[%_]/g, "\\$&").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

// 자녀 본인 기록(/records)과 부모 대시보드(/settings/records)가 함께 쓰는 목록 브라우저.
// RLS(reading_records_select)가 "본인 것만" vs "가족 전체"를 이미 갈라주므로, 이 컴포넌트는
// child_profile_id로만 필터하면 되고 보는 사람이 자녀인지 부모인지는 신경 쓸 필요가 없다.
//
// 기록이 많아져도 전부 한 번에 불러오지 않도록 무한 스크롤로 바꿨다 — 검색어/날짜가 바뀌면
// 서버에 새로 쿼리해서 처음부터 다시 불러온다(이미 쌓아둔 페이지는 필터가 바뀌는 순간 의미가
// 없어지므로). 클라이언트 전용 필터로는 아직 안 불러온 뒤쪽 페이지의 기록을 검색할 수 없어서,
// 검색은 반드시 서버 쿼리로 해야 한다.
export function RecordsBrowser({
  childId,
  initialRecords,
  layout = "list",
}: {
  childId: string;
  initialRecords: ReadingRecord[];
  // "grid"는 태블릿/PC처럼 넓은 화면에서 여러 열로 보여줄 여유가 있는 곳에서 켠다(md 미만
  // 모바일 폭에서는 "list"와 동일하게 1열로 보임 — 그리드 자체가 md부터 열이 늘어나는
  // 구조라서). 기본값은 "list"(기존 동작 그대로)이고, 그리드 배치를 실제로 쓰는 화면
  // (/records, /settings/records)이 명시적으로 "grid"를 넘긴다(2026-09-12).
  layout?: "list" | "grid";
}) {
  const hasAnyRecordsEver = initialRecords.length > 0;

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialRecords.length === RECORDS_PAGE_SIZE);

  // 응답이 요청 순서와 다르게 도착해도(느린 옛 요청이 늦게 옴) 가장 최근 요청 결과만
  // 반영하기 위한 가드.
  const requestIdRef = useRef(0);
  const isFirstRunRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 검색어 입력은 디바운스해서 타이핑마다 서버에 쿼리를 보내지 않는다.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  async function fetchPage(offset: number, replace: boolean) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from("reading_records")
        .select("*")
        .eq("child_profile_id", childId)
        .order("recorded_at", { ascending: false })
        .range(offset, offset + RECORDS_PAGE_SIZE - 1);

      if (query) {
        const pattern = toIlikePattern(query);
        q = q.or(`book_title.ilike.${pattern},content.ilike.${pattern}`);
      }
      if (startDate) q = q.gte("recorded_at", startDate);
      if (endDate) q = q.lte("recorded_at", endDate);

      const { data } = await q;
      if (requestId !== requestIdRef.current) return;

      const page = (data ?? []) as ReadingRecord[];
      setRecords((prev) => (replace ? page : [...prev, ...page]));
      setHasMore(page.length === RECORDS_PAGE_SIZE);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  // 검색어/날짜가 바뀌면 처음부터 다시 불러온다. 최초 마운트 때는 서버 컴포넌트가 이미
  // 내려준 initialRecords가 있으니 다시 부르지 않는다.
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, startDate, endDate]);

  // 목록 끝의 sentinel이 화면에 보이면 다음 페이지를 이어붙인다 — 불러온 내용이 화면을
  // 다 못 채우면(짧은 목록) sentinel이 계속 보여서 hasMore가 꺼질 때까지 자동으로 이어진다.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          fetchPage(records.length, false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, records.length, query, startDate, endDate]);

  if (!hasAnyRecordsEver) {
    return <div className="card text-center text-sm text-soft">아직 기록한 책이 없어요.</div>;
  }

  const hasFilter = query !== "" || startDate !== "" || endDate !== "";

  return (
    <div>
      {/* md 이상 넓은 화면에서는 검색창+날짜를 한 줄로 — 좁은 화면에서는 지금처럼 세로로 쌓인다. */}
      <div className="md:flex md:items-start md:gap-2">
        <input
          type="search"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="책 제목이나 내용으로 검색"
          className="input md:mb-2.5 md:flex-1"
        />
        <div className="mb-2.5 flex gap-2 md:mb-2.5 md:shrink-0">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="시작일"
            className="input mb-0"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="종료일"
            className="input mb-0"
          />
        </div>
      </div>

      {records.length === 0 && !loading ? (
        <div className="card text-center text-sm text-soft">
          {hasFilter ? "검색 결과가 없어요." : "아직 기록한 책이 없어요."}
        </div>
      ) : layout === "grid" ? (
        // [&>*]:mb-0: RecordCard(.card)가 자체적으로 갖고 있는 아래쪽 margin을 그리드 안에서는
        // 꺼서, 행 사이 간격을 gap-3 하나로만 통일한다(margin+gap이 겹쳐 행 간격만 유독
        // 넓어지는 것을 방지).
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 [&>*]:mb-0">
          {records.map((r) => (
            <RecordCard key={r.id} record={r} />
          ))}
        </div>
      ) : (
        records.map((r) => <RecordCard key={r.id} record={r} />)
      )}

      {loading && <p className="py-2 text-center text-xs text-soft">불러오는 중...</p>}
      <div ref={sentinelRef} />
    </div>
  );
}
