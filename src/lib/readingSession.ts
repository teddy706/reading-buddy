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

export type StageInstructions = Record<ReadingCoachStage, string>;

// 단계별로 AI가 참고하는 지침 문구의 기본값. azureOpenAI.ts의 generateNextQuestion이 시스템
// 프롬프트를 만들 때 쓰고, 부모 설정 화면(/settings/coach)이 "기본값" 미리보기/되돌리기용으로도
// 재사용한다 — 매번 같은 질문 패턴이 지루하지 않도록 부모가 가족 단위로 자유롭게 바꿀 수
// 있게 했다(families.custom_stage_instructions, 0009 마이그레이션).
export const DEFAULT_STAGE_INSTRUCTIONS: StageInstructions = {
  1: [
    "지금은 1단계 '장면 소환' 단계다 — 아이가 책을 실제로 읽었는지 자연스럽게 확인하면서 줄거리를 이끌어낸다.",
    "아직 '가장 큰 사건/문제'를 묻지 않았다면 그것부터 묻고, 이미 물어서 답을 들었다면 '주인공이 그 문제를 풀려고 어떤 행동을 했는지' 이어서 묻는다.",
  ].join("\n"),
  2: [
    "지금은 2단계 '역할 바꾸기' 단계다 — 아이가 인물의 마음이나 동기에 공감하고 입체적으로 생각해보게 한다.",
    "예: 주인공이 그런 결정을 했을 때 마음이 어땠을지, 또는 아이 자신이라면 그 상황에서 어떻게 했을지 묻는다.",
  ].join("\n"),
  3: [
    "지금은 3단계 '현실 적용' 단계이자 마지막 질문이다 — 책의 메시지를 아이의 실제 생활/경험과 연결지어 마무리한다.",
    "예: 비슷한 경험이 떠오르는지, 가장 인상 깊었던 장면 하나를 고른다면 무엇이고 왜 그런지 묻는다.",
  ].join("\n"),
};

// 가족이 커스텀 지침을 저장해뒀으면 그걸, 아니면(비어있거나 해당 단계 값이 없으면) 기본값을 쓴다.
// 저장된 값이 공백뿐인 경우도 기본값으로 취급한다(빈 지침으로 AI를 호출하는 사고를 막기 위함).
export function resolveStageInstruction(
  stage: ReadingCoachStage,
  custom: Partial<StageInstructions> | null | undefined
): string {
  const value = custom?.[stage];
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_STAGE_INSTRUCTIONS[stage];
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
