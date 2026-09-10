import type { ReadingCoachStage } from "@/lib/types";

// 대화 기반 기록 세션 진행 규칙. API 라우트와 클라이언트 화면(진행 인디케이터)이 공유한다.
export const TOTAL_QUESTIONS = 4;

// 단계별 독서록 유도 질문 프레임워크(사용자 설계, 2026-09-10 도입):
// 1단계 "장면 소환"(줄거리 확인, 질문 2개) → 2단계 "역할 바꾸기"(공감·비판적 사고) →
// 3단계 "현실 적용"(자기화). 감상문은 이 단계별 답변을 처음/가운데/끝 3단 구성으로 조립한다.
export const STAGE_LABELS: Record<ReadingCoachStage, string> = {
  1: "장면 소환",
  2: "역할 바꾸기",
  3: "현실 적용",
};

export const STAGE_PLAN: ReadingCoachStage[] = [1, 1, 2, 3];

export function stageForQuestionIndex(questionIndex: number): ReadingCoachStage {
  return STAGE_PLAN[questionIndex] ?? 3;
}

// OpenAI 호출 실패 시 폴백으로 쓰는 고정 질문(PRD 9.5). STAGE_PLAN과 1:1로 대응해서
// 실패 상황에도 단계별 프레임워크의 흐름(사건→행동→공감→현실 적용)을 그대로 유지한다.
export const FALLBACK_QUESTIONS = [
  "이 이야기에서 주인공에게 닥친 가장 큰 사건이나 문제가 뭐였어?",
  "주인공이 그 문제를 풀려고 어떤 행동을 했어?",
  "주인공이 그런 결정을 했을 때 마음이 어땠을까? 너라면 어떻게 했을 것 같아?",
  "이 책을 읽고 나서 네 생활에서 비슷한 경험이 떠올라?",
] as const;

export function fallbackQuestion(questionIndex: number) {
  return FALLBACK_QUESTIONS[questionIndex] ?? "그 책에 대해 더 이야기해줄래?";
}
