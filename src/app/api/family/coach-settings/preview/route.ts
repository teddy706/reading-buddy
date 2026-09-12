import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/currentProfile";
import { generateNextQuestion } from "@/lib/azureOpenAI";
import type { ConversationMessage, ReadingCoachStage } from "@/lib/types";

const STAGES: ReadingCoachStage[] = [1, 2, 3];
const MAX_LENGTH = 500;

// 미리보기용 고정 예시 책 — 실제 아이 대화가 아니라 부모가 지침 문구를 저장하기 전에
// "이렇게 물어보면 실제로 어떤 질문이 나올까"를 바로 확인해보는 용도라, 늘 같은 책으로
// 고정해야 지침 문구를 바꿔가며 결과를 공정하게 비교할 수 있다. 줄거리 요약은 사실 관계만
// 담은 한두 문장이라 저작권 있는 원문을 옮긴 게 아니다.
const SAMPLE_BOOK_TITLE = "무지개 물고기";
const SAMPLE_BOOK_CONTEXT =
  "반짝이는 비늘을 가진 물고기가 처음엔 비늘을 나눠주기 싫어해 친구들에게 따돌림을 당하다가, 문어 할머니의 조언을 듣고 비늘을 하나씩 나눠주면서 진짜 친구를 사귀게 되는 이야기.";

// 1단계 질문 2개(장면 소환) → 2단계 질문 1개(역할 바꾸기) → 3단계 질문 1개(현실 적용) 순서로
// 실제 대화가 진행되는 것과 똑같은 흐름을 시뮬레이션한다. 대상 단계 자체는 지금 편집 중인
// (아직 저장 전일 수 있는) 지침 문구로 실제 generateNextQuestion을 호출해서 만들고, 그보다
// 앞선 단계는 미리보기가 자연스럽게 이어지도록 예시 답변만 고정해서 채워 넣는다 — 이 예시
// 답변은 실제 아이가 한 말이 아니라 미리보기 목적의 가상 시나리오임을 화면에서도 분명히 밝힌다.
const CANNED_HISTORY: ConversationMessage[] = [
  { role: "assistant", content: "물고기들이 무지개 물고기한테 비늘 좀 나눠달라고 했을 때, 무지개 물고기는 어떻게 했어?", stage: 1, created_at: "" },
  { role: "child", content: "싫다고 하면서 안 나눠줬어요.", created_at: "" },
  { role: "assistant", content: "그다음에 무지개 물고기한테 무슨 일이 생겼어?", stage: 1, created_at: "" },
  { role: "child", content: "친구들이 다 무지개 물고기랑 안 놀아줘서 혼자가 됐어요.", created_at: "" },
  { role: "assistant", content: "그때 무지개 물고기 마음이 어땠을 것 같아?", stage: 2, created_at: "" },
  { role: "child", content: "많이 슬프고 외로웠을 것 같아요.", created_at: "" },
];

// 대상 단계의 "이번이 몇 번째 계획된 질문인지"(STAGE_PLAN=[1,1,2,3] 기준) + 그 단계까지의
// 대화 기록만 잘라서 넘긴다 — 실제 next-question 라우트가 매 턴 넘기는 값과 동일한 모양.
const STAGE_PREVIEW_CONTEXT: Record<ReadingCoachStage, { questionIndex: number; history: ConversationMessage[] }> = {
  1: { questionIndex: 0, history: [] },
  2: { questionIndex: 2, history: CANNED_HISTORY.slice(0, 4) },
  3: { questionIndex: 3, history: CANNED_HISTORY.slice(0, 6) },
};

// 부모 전용: /settings/coach에서 지침 문구를 아직 저장하지 않은 채로("저장" 없이) 바로
// 어떤 질문이 나올지 미리 보여준다. 실제 저장/DB 반영은 하지 않고, 지금 입력창에 있는
// 텍스트를 그대로 generateNextQuestion에 1회성으로 넘겨 호출한다.
export async function POST(request: Request) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });

  const { stage, instruction } = await request.json();

  if (!STAGES.includes(stage)) {
    return NextResponse.json({ error: "단계가 올바르지 않아요." }, { status: 400 });
  }
  if (typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json({ error: "미리 볼 지침 문구를 입력해주세요." }, { status: 400 });
  }
  if (instruction.length > MAX_LENGTH) {
    return NextResponse.json({ error: `지침은 ${MAX_LENGTH}자 이내로 입력해주세요.` }, { status: 400 });
  }

  const { questionIndex, history } = STAGE_PREVIEW_CONTEXT[stage as ReadingCoachStage];

  const question = await generateNextQuestion({
    bookTitle: SAMPLE_BOOK_TITLE,
    bookAuthor: null,
    bookContext: SAMPLE_BOOK_CONTEXT,
    history,
    questionIndex,
    stage: stage as ReadingCoachStage,
    customStageInstructions: { [stage]: instruction.trim() } as Partial<Record<ReadingCoachStage, string>>,
  });

  return NextResponse.json({ question, sampleBookTitle: SAMPLE_BOOK_TITLE });
}
