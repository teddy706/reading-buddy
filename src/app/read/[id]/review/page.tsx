import { notFound, redirect } from "next/navigation";
import { requireChildProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { ReviewSession } from "@/components/ReviewSession";

export default async function ReviewPage({ params }: { params: { id: string } }) {
  await requireChildProfile();

  const supabase = createClient();
  const { data: session } = await supabase.from("conversation_sessions").select("*").eq("id", params.id).maybeSingle();

  if (!session) notFound();
  if (session.status === "completed") redirect("/home");

  return <ReviewSession session={session} />;
}
