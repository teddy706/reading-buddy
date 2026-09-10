// 대화 기반 기록 세션 진행 규칙. API 라우트와 클라이언트 화면(진행 인디케이터)이 공유한다.
export const TOTAL_QUESTIONS = 4;

// OpenAI 호출 실패 시 폴백으로 쓰는 고정 질문 3개(PRD 9.5). 부족하면 마지막 질문으로 채운다.
export const FALLBACK_QUESTIONS = [
  "그 책 재미있었어?",
  "제일 기억에 남는 장면이나 인물이 있었어?",
  "그 책을 읽고 나서 어떤 생각이 들었어?",
] as const;

export function fallbackQuestion(questionIndex: number) {
  return FALLBACK_QUESTIONS[questionIndex] ?? "그 책에 대해 더 이야기해줄래?";
}
