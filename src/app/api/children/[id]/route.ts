import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/currentProfile";
import { AVATAR_OPTIONS } from "@/components/Avatar";
import { AVATAR_PHOTO_BUCKET, avatarPhotoPath } from "@/lib/avatarPhoto";

// 부모 전용: 자녀 이름/이모지 아바타/아바타 사진 경로 수정.
// 사진 자체는 클라이언트가 Storage에 먼저 직접 업로드하고(avatars 버킷, storage RLS가
// family_id+parent 역할로 이미 막아준다), 이 라우트는 그 경로를 profiles에 기록만 한다.
// avatarPhotoPath가 명시적으로 null이면 "사진 제거" 요청 — 이모지로 되돌리고 Storage 파일도 지운다.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });

  const body = await request.json();
  const { name, avatar } = body;
  const update: { name?: string; avatar?: string; avatar_photo_path?: string | null } = {};
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (typeof avatar === "string" && AVATAR_OPTIONS.includes(avatar)) update.avatar = avatar;

  const removingPhoto = "avatarPhotoPath" in body && body.avatarPhotoPath === null;
  if (typeof body.avatarPhotoPath === "string" && body.avatarPhotoPath) {
    update.avatar_photo_path = body.avatarPhotoPath;
  } else if (removingPhoto) {
    update.avatar_photo_path = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (removingPhoto) {
    await admin.storage.from(AVATAR_PHOTO_BUCKET).remove([avatarPhotoPath(parent.family_id, params.id)]);
  }

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

// 부모 전용: 자녀 프로필 완전 삭제. auth 계정을 지우면 profiles.user_id의
// on delete cascade(0001_schema.sql)로 프로필 row와 그 아래 reading_records/
// conversation_sessions/ocr_uploads까지 전부 함께 지워진다 — 되돌릴 수 없다.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });

  const admin = createAdminClient();

  const { data: child } = await admin
    .from("profiles")
    .select("id, user_id, avatar_photo_path")
    .eq("id", params.id)
    .eq("family_id", parent.family_id)
    .eq("role", "child")
    .maybeSingle();

  if (!child) {
    return NextResponse.json({ error: "자녀를 찾을 수 없어요." }, { status: 404 });
  }

  if (child.avatar_photo_path) {
    await admin.storage.from(AVATAR_PHOTO_BUCKET).remove([child.avatar_photo_path]);
  }

  if (child.user_id) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(child.user_id);
    if (deleteUserError) {
      return NextResponse.json({ error: "삭제하지 못했어요." }, { status: 500 });
    }
  } else {
    const { error: deleteProfileError } = await admin.from("profiles").delete().eq("id", child.id);
    if (deleteProfileError) {
      return NextResponse.json({ error: "삭제하지 못했어요." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
