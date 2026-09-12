import Link from "next/link";
import { DokseoroStatusBadge } from "@/components/DokseoroStatusBadge";
import type { ReadingRecord } from "@/lib/types";

const SOURCE_LABEL: Record<ReadingRecord["source_type"], string> = {
  conversation: "💬 대화",
  ocr: "📷 독서노트",
  manual: "✏️ 직접 입력",
};

export function RecordCard({ record }: { record: ReadingRecord }) {
  return (
    <Link href={`/records/${record.id}`} className="card block">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-bold">{record.book_title}</p>
        <DokseoroStatusBadge status={record.dokseoro_status} />
      </div>
      <p className="mb-2 text-sm text-soft">
        {record.recorded_at} · {SOURCE_LABEL[record.source_type]}
        {record.page_count != null && ` · ${record.page_count}쪽`}
      </p>
      <p className="line-clamp-2 text-sm">{record.content}</p>
    </Link>
  );
}
