import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/currentProfile";
import { childProfileEmail, deriveChildAuthPassword, hashPinForDisplay, isValidPin } from "@/lib/childAuth";
import { AVATAR_OPTIONS } from "@/components/Avatar";

// 자녀 프로필 생성: profiles row 생성 -> synthetic auth 계정 생성 -> user_id 연결.
// 셋 다 서비스 롤로 하는 "프로비저닝"이라 여기서만 admin 클라이언트를 쓴다(클라이언트 RLS로는 불가능).
//
// API 라우트 안에서는 currentProfile.ts의 require*() 대신 이렇게 수동으로 401/403을 반환한다 —
// redirect()는 리다이렉트 Response를 던지는데, fetch()로 호출하는 JSON API에서는 클라이언트가
// 그걸 에러로 다루기 애매해지기 때문(리다이렉트를 따라가 로그인 페이지의 HTML을 json()으로
// 파싱하려다 실패하게 됨). Route Handler에서는 항상 명시적 status의 JSON을 돌려준다.
export async function POST(request: Request) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 프로필을 만들 수 있어요." }, { status: 403 });

  const { name, avatar, pin } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  if (!isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN은 숫자 4자리로 입력해주세요." }, { status: 400 });
  }
  const finalAvatar = AVATAR_OPTIONS.includes(avatar) ? avatar : AVATAR_OPTIONS[0];

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      family_id: parent.family_id,
      role: "child",
      name: name.trim(),
      avatar: finalAvatar,
      pin_hash: await hashPinForDisplay(String(pin)),
    })
    .select()
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "프로필을 만들지 못했어요." }, { status: 500 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: childProfileEmail(profile.id),
    password: deriveChildAuthPassword(profile.id, String(pin)),
    email_confirm: true,
    user_metadata: { role: "child", profile_id: profile.id },
  });

  if (userError || !userData.user) {
    await admin.from("profiles").delete().eq("id", profile.id);
    return NextResponse.json({ error: "프로필 계정을 만들지 못했어요." }, { status: 500 });
  }

  const { error: linkError } = await admin.from("profiles").update({ user_id: userData.user.id }).eq("id", profile.id);
  if (linkError) {
    await admin.auth.admin.deleteUser(userData.user.id);
    await admin.from("profiles").delete().eq("id", profile.id);
    return NextResponse.json({ error: "프로필 계정을 연결하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    profile: { id: profile.id, name: profile.name, avatar: profile.avatar, family_id: profile.family_id },
  });
}
