import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// 서버 컴포넌트/라우트 핸들러에서 "지금 로그인한 세션이 누구인지"를 한 번에 가져온다.
// role 분기는 항상 이 함수가 돌려준 profile.role 기준으로 한다 — 부모/자녀 세션은
// PIN 전환 시 실제로 auth 세션 자체가 바뀌므로(childAuth.ts 참고) auth.uid()로 충분하다.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();

  return profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireParentProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "parent") redirect("/home");
  return profile;
}

export async function requireChildProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "child") redirect("/profiles");
  return profile;
}
