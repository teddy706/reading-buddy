import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/currentProfile";
import {
  childProfileEmail,
  deriveChildAuthPassword,
  isPinLocked,
  isValidPin,
  PIN_LOCK_DURATION_MS,
  PIN_MAX_ATTEMPTS,
} from "@/lib/childAuth";

// PIN 검증 + 자녀 세션 전환. 이 라우트를 타는 시점엔 아직 부모 세션이 살아있다
// (② 프로필 선택 화면에서 온 요청) — 성공하면 이 요청이 부모 세션을 자녀의 synthetic
// 계정 세션으로 "교체"한다(docs/PRD.md 9.1 구현 노트 참고).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requester = await getCurrentProfile();
  if (!requester) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { pin } = await request.json();
  if (!isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN 4자리를 입력해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, family_id, role, pin_fail_count, pin_locked_until")
    .eq("id", params.id)
    .eq("family_id", requester.family_id)
    .eq("role", "child")
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 404 });
  }

  if (isPinLocked(profile)) {
    const remainingSec = Math.max(0, Math.ceil((new Date(profile.pin_locked_until!).getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: `너무 많이 틀렸어요. ${remainingSec}초 후 다시 시도해주세요.`, lockedForSec: remainingSec },
      { status: 429 }
    );
  }

  const email = childProfileEmail(profile.id);
  const password = deriveChildAuthPassword(profile.id, String(pin));

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const nextCount = profile.pin_fail_count + 1;
    if (nextCount >= PIN_MAX_ATTEMPTS) {
      await admin
        .from("profiles")
        .update({ pin_fail_count: 0, pin_locked_until: new Date(Date.now() + PIN_LOCK_DURATION_MS).toISOString() })
        .eq("id", profile.id);
      return NextResponse.json(
        { error: "너무 많이 틀렸어요. 1분 후 다시 시도해주세요.", lockedForSec: PIN_LOCK_DURATION_MS / 1000 },
        { status: 429 }
      );
    }
    await admin.from("profiles").update({ pin_fail_count: nextCount }).eq("id", profile.id);
    return NextResponse.json(
      { error: "PIN이 맞지 않아요.", attemptsLeft: PIN_MAX_ATTEMPTS - nextCount },
      { status: 401 }
    );
  }

  await admin.from("profiles").update({ pin_fail_count: 0, pin_locked_until: null }).eq("id", profile.id);
  return NextResponse.json({ ok: true });
}
