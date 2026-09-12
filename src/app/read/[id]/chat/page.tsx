import { notFound } from "next/navigation";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { ChatSession } from "@/components/ChatSession";

// Next.js 기본 fetch 캐시로 인한 Supabase 응답 재사용 방지 — src/app/records/page.tsx 참고.
export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: { id: string } }) {
  await requireChildProfile();

  const supabase = createClient();
  const { data: session } = await supabase.from("conversation_sessions").select("*").eq("id", params.id).maybeSingle();

  if (!session) notFound();

  return <ChatSession session={session} />;
}
