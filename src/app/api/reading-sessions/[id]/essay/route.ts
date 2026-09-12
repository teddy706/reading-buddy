import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireChildProfileForApi } from "@/lib/currentProfile";
import { generateEssay } from "@/lib/azureOpenAI";
import type { ConversationMessage } from "@/lib/types";

// 질문 개수와 무관하게 지금까지의 대화로 감상문을 만든다.
// /read/[id]/review 페이지 자체가 자녀 전용(requireChildProfile)이라 이 라우트도 동일하게 막는다.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const profile = await requireChildProfileForApi();
  if (profile instanceof NextResponse) return profile;

  const supabase = createClient();

  const { data: session, error: fetchError } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !session) {
    return NextResponse.json({ error: "대화 세션을 찾을 수 없어요." }, { status: 404 });
  }

  const messages: ConversationMessage[] = Array.isArray(session.messages) ? session.messages : [];
  if (!messages.some((m) => m.role === "child")) {
    return NextResponse.json({ error: "아직 답변한 내용이 없어요." }, { status: 400 });
  }

  try {
    const essay = await generateEssay({
      bookTitle: session.book_title,
      bookAuthor: session.book_author,
      history: messages,
    });
    return NextResponse.json({ essay });
  } catch {
    return NextResponse.json({ error: "감상문을 만들지 못했어요. 다시 시도해주세요." }, { status: 502 });
  }
}
