import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/joinCode";

// 부모 회원가입: auth 계정 생성 -> family 생성 -> parent profile 생성 -> 로그인.
// family/profile 생성은 RLS를 우회해야 하는 "프로비저닝"이라 admin(service role) 클라이언트를 쓴다.
export async function POST(request: Request) {
  const { email, password, parentName, familyName } = await request.json();

  if (!email || !password || !parentName) {
    return NextResponse.json({ error: "이메일, 비밀번호, 이름을 모두 입력해주세요." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 해요." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "parent" },
  });

  if (userError || !userData.user) {
    const message = userError?.message?.includes("already been registered")
      ? "이미 가입된 이메일이에요."
      : userError?.message ?? "회원가입에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const authUserId = userData.user.id;

  const joinCode = generateJoinCode();
  const { data: family, error: familyError } = await admin
    .from("families")
    .insert({ name: familyName?.trim() || "우리 가족", join_code: joinCode })
    .select()
    .single();

  if (familyError || !family) {
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: "가족 정보를 만들지 못했어요." }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    family_id: family.id,
    user_id: authUserId,
    role: "parent",
    name: parentName.trim(),
    avatar: "🧑",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUserId);
    await admin.from("families").delete().eq("id", family.id);
    return NextResponse.json({ error: "부모 프로필을 만들지 못했어요." }, { status: 500 });
  }

  // 방금 만든 계정으로 세션을 발급해 브라우저 쿠키에 저장한다.
  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: "가입은 됐지만 로그인에 실패했어요. 다시 로그인해주세요." }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
