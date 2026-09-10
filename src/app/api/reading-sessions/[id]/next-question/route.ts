import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateNextQuestion } from "@/lib/azureOpenAI";
import { fetchBookContext } from "@/lib/kakaoBook";
import { TOTAL_QUESTIONS, stageForQuestionIndex } from "@/lib/readingSession";
import type { ConversationMessage } from "@/lib/types";

// 대화 진행 화면이 매 턴 호출한다. answerText가 있으면 먼저 아이 답변을 messages에 추가하고,
// 그 다음 답변 개수가 TOTAL_QUESTIONS에 도달했는지 확인해서 done 여부와 다음 질문을 함께 돌려준다.
// 세션 소유권 확인은 RLS(conversation_sessions_select/update)가 전담한다 — anon key로 충분하다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { answerText } = await request.json().catch(() => ({ answerText: undefined }));

  const { data: session, error: fetchError } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !session) {
    return NextResponse.json({ error: "대화 세션을 찾을 수 없어요." }, { status: 404 });
  }

  const messages: ConversationMessage[] = Array.isArray(session.messages) ? session.messages : [];

  if (typeof answerText === "string" && answerText.trim()) {
    messages.push({ role: "child", content: answerText.trim(), created_at: new Date().toISOString() });
  }

  const answeredCount = messages.filter((m) => m.role === "child").length;

  if (answeredCount >= TOTAL_QUESTIONS) {
    const { error: updateError } = await supabase
      .from("conversation_sessions")
      .update({ messages })
      .eq("id", session.id);
    if (updateError) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
    return NextResponse.json({ done: true, messages });
  }

  const bookContext = await fetchBookContext(session.book_title, session.book_author);
  const stage = stageForQuestionIndex(answeredCount);

  const question = await generateNextQuestion({
    bookTitle: session.book_title,
    bookAuthor: session.book_author,
    bookContext,
    history: messages,
    questionIndex: answeredCount,
    stage,
  });

  messages.push({
    role: "assistant",
    content: question ?? "그 책에 대해 더 이야기해줄래?",
    created_at: new Date().toISOString(),
    stage,
  });

  const { error: updateError } = await supabase.from("conversation_sessions").update({ messages }).eq("id", session.id);
  if (updateError) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });

  return NextResponse.json({ done: false, messages });
}
