import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireChildProfileForApi } from "@/lib/currentProfile";
import { generateNextQuestion } from "@/lib/azureOpenAI";
import { fetchBookContext } from "@/lib/kakaoBook";
import {
  TOTAL_QUESTIONS,
  MAX_FOLLOW_UPS_PER_STAGE,
  stageForQuestionIndex,
  isAnswerTooShort,
  type StageInstructions,
} from "@/lib/readingSession";
import type { ConversationMessage } from "@/lib/types";

// 대화 진행 화면이 매 턴 호출한다. answerText가 있으면 먼저 아이 답변을 messages에 추가한다.
// 완료/진행 판정은 "계획된"(팔로업이 아닌) 질문에 답한 개수 기준이다 — 답이 너무 짧으면
// (readingSession.ts의 isAnswerTooShort) 같은 단계에서 한 번 더 캐묻는 팔로업 질문을 끼워
// 넣고, 그 팔로업에 답한 건 새 단계로 진행한 것으로 세지 않는다(2026-09-12 사용자 피드백:
// "AI 개입이 더 적극적이면 좋겠다" — 답변은 부실한데 AI가 다듬은 감상문만 잘 나오는
// 간극을 줄이기 위함). 단계당 팔로업은 MAX_FOLLOW_UPS_PER_STAGE(1)회로 제한해서 대화가
// 끝없이 늘어지지 않게 한다.
// /read/[id]/chat 페이지 자체가 자녀 전용(requireChildProfile)이라 이 라우트도 동일하게 막는다.
// 세션 소유권 확인은 RLS(conversation_sessions_select/update)가 전담한다 — 역할까지 자녀로
// 좁혀두면 RLS의 "child_profile_id = my_profile_id()" 조건까지 자연스럽게 강제된다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;

  const supabase = createClient();
  const { answerText } = await request.json().catch(() => ({ answerText: undefined }));

  // 세션과 "부모가 커스텀한 질문 지침(families.custom_stage_instructions)"은 서로 의존하지
  // 않으니 병렬로 가져온다 — family_id는 이미 profile에 있어서 세션 조회를 기다릴 필요가 없다.
  const [{ data: session, error: fetchError }, { data: family }] = await Promise.all([
    supabase.from("conversation_sessions").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("families").select("custom_stage_instructions").eq("id", profile.family_id).maybeSingle(),
  ]);

  if (fetchError || !session) {
    return NextResponse.json({ error: "대화 세션을 찾을 수 없어요." }, { status: 404 });
  }

  const messages: ConversationMessage[] = Array.isArray(session.messages) ? session.messages : [];

  let lastAnswerText: string | null = null;
  if (typeof answerText === "string" && answerText.trim()) {
    lastAnswerText = answerText.trim();
    messages.push({ role: "child", content: lastAnswerText, created_at: new Date().toISOString() });
  }

  // 팔로업이 아닌(계획된) 질문에 답한 개수만 센다 — 팔로업 답변은 같은 단계를 더 파고든
  // 것일 뿐 새 단계로 진행한 게 아니다.
  const plannedAnsweredCount = messages.filter(
    (m, i) => m.role === "child" && messages[i - 1]?.role === "assistant" && !messages[i - 1]?.isFollowUp
  ).length;

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const lastStage = lastAssistantMessage?.stage;
  const followUpUsedForLastStage =
    lastStage != null &&
    messages.filter((m) => m.role === "assistant" && m.stage === lastStage && m.isFollowUp).length >=
      MAX_FOLLOW_UPS_PER_STAGE;

  const canFollowUp =
    lastAnswerText !== null && lastStage != null && !followUpUsedForLastStage && isAnswerTooShort(lastAnswerText);
  const morePlannedQuestionsLeft = plannedAnsweredCount < TOTAL_QUESTIONS;

  if (!canFollowUp && !morePlannedQuestionsLeft) {
    const { error: updateError } = await supabase
      .from("conversation_sessions")
      .update({ messages })
      .eq("id", session.id);
    if (updateError) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
    return NextResponse.json({ done: true, messages });
  }

  const bookContext = await fetchBookContext(session.book_title, session.book_author);
  const isFollowUp = canFollowUp;
  const stage = isFollowUp ? lastStage! : stageForQuestionIndex(plannedAnsweredCount);

  const question = await generateNextQuestion({
    bookTitle: session.book_title,
    bookAuthor: session.book_author,
    bookContext,
    history: messages,
    questionIndex: plannedAnsweredCount,
    stage,
    customStageInstructions: (family?.custom_stage_instructions as Partial<StageInstructions> | null) ?? null,
    isFollowUp,
  });

  messages.push({
    role: "assistant",
    content: question,
    created_at: new Date().toISOString(),
    stage,
    ...(isFollowUp ? { isFollowUp: true as const } : {}),
  });

  const { error: updateError } = await supabase.from("conversation_sessions").update({ messages }).eq("id", session.id);
  if (updateError) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });

  // bookContext를 화면에도 그대로 돌려준다 — 카카오에서 어떤 정보를 참고했는지(찾았다면 그
  // 내용을, 못 찾았다면 null을) 아이/부모가 알 수 있게 ChatSession이 보여준다.
  // progress는 "계획된" 질문 기준 진행률 — 팔로업 중엔 이전 숫자 그대로 유지된다.
  return NextResponse.json({
    done: false,
    messages,
    bookContext,
    progress: { current: Math.min(plannedAnsweredCount, TOTAL_QUESTIONS), total: TOTAL_QUESTIONS },
    isFollowUp,
  });
}
