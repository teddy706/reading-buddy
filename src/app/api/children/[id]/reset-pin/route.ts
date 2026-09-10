import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/currentProfile";
import { deriveChildAuthPassword, hashPinForDisplay, isValidPin } from "@/lib/childAuth";

// 부모 전용: 자녀 PIN 재설정. synthetic 계정의 실제 비밀번호(=PIN에서 파생된 값)와
// 표시/대조용 pin_hash를 함께 갱신하고, 잠금 상태도 초기화한다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });

  const { pin } = await request.json();
  if (!isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN은 숫자 4자리로 입력해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, family_id, user_id, role")
    .eq("id", params.id)
    .eq("family_id", parent.family_id)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || !profile.user_id) {
    return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 404 });
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(profile.user_id, {
    password: deriveChildAuthPassword(profile.id, String(pin)),
  });
  if (passwordError) {
    return NextResponse.json({ error: "PIN을 변경하지 못했어요." }, { status: 500 });
  }

  await admin
    .from("profiles")
    .update({
      pin_hash: await hashPinForDisplay(String(pin)),
      pin_fail_count: 0,
      pin_locked_until: null,
    })
    .eq("id", profile.id);

  return NextResponse.json({ ok: true });
}
