import type { ReadingRecord } from "@/lib/types";

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

// 형제자매 비교(이달의 다독왕)를 제외한 배지는 순수 누적 기록 기반이라, 기록을 지우지 않는 한
// 한 번 얻으면 계속 유지된다 — 그래서 "획득 여부"를 저장하는 별도 테이블 없이 매번 reading_records에서
// 즉석 계산한다(Phase 2 D 범위 안에서 스키마 변경 없이 구현하기 위한 선택).
export const BADGE_CATALOG: Badge[] = [
  { id: "first-book", emoji: "🌱", title: "첫 걸음", description: "책을 처음 기록했어요" },
  { id: "five-books", emoji: "📚", title: "책벌레", description: "책 5권을 기록했어요" },
  { id: "ten-books", emoji: "🏆", title: "독서왕", description: "책 10권을 기록했어요" },
  { id: "storyteller", emoji: "💬", title: "이야기꾼", description: "대화로 3번 기록했어요" },
  { id: "photo-detective", emoji: "📷", title: "기록 탐정", description: "독서노트 사진으로 3번 기록했어요" },
  { id: "dokseoro-keeper", emoji: "✅", title: "독서로 지킴이", description: "'독서로'에 5번 반영했어요" },
  { id: "monthly-champion", emoji: "🔥", title: "이달의 다독왕", description: "이번 달 형제자매 중 가장 많이 읽었어요" },
];

export interface BadgeProgress {
  badge: Badge;
  earned: boolean;
  progressText: string;
}

// siblingsThisMonthCounts: 같은 가족의 "다른" 자녀들의 이번 달 기록 수(비교 대상).
// 자녀가 한 명뿐이면 빈 배열을 넘겨서 monthly-champion 배지를 카탈로그에서 제외한다 —
// 비교 상대가 없는데 "다독왕"을 주는 건 의미가 없다고 판단.
export function computeBadges(
  childRecords: ReadingRecord[],
  siblingsThisMonthCounts: number[],
  thisMonthKey: string
): BadgeProgress[] {
  const total = childRecords.length;
  const conversationCount = childRecords.filter((r) => r.source_type === "conversation").length;
  const ocrCount = childRecords.filter((r) => r.source_type === "ocr").length;
  const syncedCount = childRecords.filter((r) => r.dokseoro_status === "synced").length;
  const thisMonthCount = childRecords.filter((r) => r.recorded_at.slice(0, 7) === thisMonthKey).length;
  const hasSiblings = siblingsThisMonthCounts.length > 0;
  const maxSiblingThisMonth = hasSiblings ? Math.max(...siblingsThisMonthCounts) : 0;

  const progressByBadgeId: Record<string, BadgeProgress> = {
    "first-book": {
      badge: BADGE_CATALOG[0],
      earned: total >= 1,
      progressText: `${Math.min(total, 1)}/1권`,
    },
    "five-books": {
      badge: BADGE_CATALOG[1],
      earned: total >= 5,
      progressText: `${Math.min(total, 5)}/5권`,
    },
    "ten-books": {
      badge: BADGE_CATALOG[2],
      earned: total >= 10,
      progressText: `${Math.min(total, 10)}/10권`,
    },
    storyteller: {
      badge: BADGE_CATALOG[3],
      earned: conversationCount >= 3,
      progressText: `${Math.min(conversationCount, 3)}/3회`,
    },
    "photo-detective": {
      badge: BADGE_CATALOG[4],
      earned: ocrCount >= 3,
      progressText: `${Math.min(ocrCount, 3)}/3회`,
    },
    "dokseoro-keeper": {
      badge: BADGE_CATALOG[5],
      earned: syncedCount >= 5,
      progressText: `${Math.min(syncedCount, 5)}/5건`,
    },
    "monthly-champion": {
      badge: BADGE_CATALOG[6],
      earned: hasSiblings && thisMonthCount > 0 && thisMonthCount >= maxSiblingThisMonth,
      progressText: `이번 달 ${thisMonthCount}권`,
    },
  };

  const catalog = hasSiblings ? BADGE_CATALOG : BADGE_CATALOG.filter((b) => b.id !== "monthly-champion");
  return catalog.map((badge) => progressByBadgeId[badge.id]);
}
