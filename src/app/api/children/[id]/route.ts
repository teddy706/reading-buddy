import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/currentProfile";
import { AVATAR_OPTIONS } from "@/components/Avatar";

// 부모 전용: 자녀 이름/아바타 수정.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });

  const { name, avatar } = await request.json();
  const update: { name?: string; avatar?: string } = {};
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (typeof avatar === "string" && AVATAR_OPTIONS.includes(avatar)) update.avatar = avatar;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", params.id)
    .eq("family_id", parent.family_id)
    .eq("role", "child");

  if (error) {
    return NextResponse.json({ error: "수정하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
