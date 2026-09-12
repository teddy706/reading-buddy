import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// 서버 컴포넌트/라우트 핸들러에서 "지금 로그인한 세션이 누구인지"를 한 번에 가져온다.
// role 분기는 항상 이 함수가 돌려준 profile.role 기준으로 한다 — 부모/자녀 세션은
// PIN 전환 시 실제로 auth 세션 자체가 바뀌므로(childAuth.ts 참고) auth.uid()로 충분하다.
//
// getUser()가 아니라 getSession()을 쓴다: getUser()는 매번 Supabase Auth 서버에
// 네트워크로 재검증하러 가는데(왕복 지연), middleware.ts가 이 요청이 들어올 때 이미
// getUser()로 세션을 검증/갱신했으므로(같은 요청 생명주기 안에서 미들웨어가 먼저 실행됨)
// 여기서 또 검증할 필요가 없다 — getSession()은 쿠키의 JWT를 로컬에서 읽기만 해서
// 페이지 하나당 왕복 한 번을 없애준다. 이 함수가 페이지 렌더마다(때로는 여러 곳에서)
// 호출되는 만큼 체감 효과가 크다.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle();

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

// requireChildProfile()의 API 라우트 버전. 라우트 핸들러는 redirect() 대신 JSON 에러 응답을
// 돌려줘야 하므로 별도로 둔다 — 대화/OCR/표지 인식 관련 라우트는 자녀 전용 페이지에서만
// 호출되지만, 페이지 가드(requireChildProfile)만으로는 API를 직접 호출하는 것까지 막지
// 못하므로(부모 세션으로 URL을 직접 열지 않고 fetch만 흉내내도 뚫림) API 쪽에도 같은 검사를 둔다.
export async function requireChildProfileForApi(): Promise<Profile | NextResponse> {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (profile.role !== "child") return NextResponse.json({ error: "자녀만 할 수 있어요." }, { status: 403 });
  return profile;
}
