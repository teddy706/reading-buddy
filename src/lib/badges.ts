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

// 연간 독서 챌린지: "1년에 100권"처럼 해가 바뀔 때마다 새로 도전할 수 있는 배지.
// 다른 배지는 한 번 얻으면 계속 유지되는 누적 기록이지만, 이건 매년 리셋되는 챌린지라
// BADGE_CATALOG(고정 목록)에 넣는 대신 "그동안의 연도별 결과 + 올해 진행 상황" 목록으로 반환한다.
export const YEARLY_CHALLENGE_TARGET = 100;

export interface YearlyChallenge {
  year: string; // "YYYY"
  count: number;
  target: number;
  earned: boolean;
  // 그해 1~12월 권수(index 0 = 1월) — 사용자 요청으로 "월별 달성도"를 함께 보여주기 위해 추가.
  monthlyCounts: number[];
}

function monthlyCountsForYear(records: ReadingRecord[], year: string): number[] {
  const counts = new Array(12).fill(0);
  for (const r of records) {
    if (r.recorded_at.slice(0, 4) !== year) continue;
    const monthIndex = Number(r.recorded_at.slice(5, 7)) - 1;
    counts[monthIndex] += 1;
  }
  return counts;
}

// currentYearKey는 항상 목록에 포함(그해 기록이 0건이어도 "올해의 챌린지"를 보여주기 위함).
// 그 외의 연도는 기록이 1건 이상 있는 해만 포함 — 아이가 아직 활동하지 않은 과거 연도를
// 빈 챌린지로 나열할 필요는 없다고 판단. 최신 연도가 먼저 오도록 내림차순 정렬.
export function computeYearlyChallenges(childRecords: ReadingRecord[], currentYearKey: string): YearlyChallenge[] {
  const countByYear = new Map<string, number>();
  for (const r of childRecords) {
    const year = r.recorded_at.slice(0, 4);
    countByYear.set(year, (countByYear.get(year) ?? 0) + 1);
  }
  if (!countByYear.has(currentYearKey)) countByYear.set(currentYearKey, 0);

  return Array.from(countByYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => ({
      year,
      count,
      target: YEARLY_CHALLENGE_TARGET,
      earned: count >= YEARLY_CHALLENGE_TARGET,
      monthlyCounts: monthlyCountsForYear(childRecords, year),
    }));
}
