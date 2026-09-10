import { notFound } from "next/navigation";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { ChatSession } from "@/components/ChatSession";

export default async function ChatPage({ params }: { params: { id: string } }) {
  await requireChildProfile();

  const supabase = createClient();
  const { data: session } = await supabase.from("conversation_sessions").select("*").eq("id", params.id).maybeSingle();

  if (!session) notFound();

  return <ChatSession session={session} />;
}
