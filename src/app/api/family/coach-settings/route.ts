import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/currentProfile";
import { demoBlockResponse } from "@/lib/demoMode";
import type { ReadingCoachStage } from "@/lib/types";

const STAGES: ReadingCoachStage[] = [1, 2, 3];
const MAX_LENGTH = 500;

// 부모 전용: AI가 대화 단계별로 참고하는 질문 지침(families.custom_stage_instructions)을
// 가족 단위로 수정/초기화한다. families 테이블은 select 정책만 있고 쓰기는 서버(service role)
// 에서만 하므로(0003_rls.sql) admin 클라이언트를 쓴다 — 자녀 프로필 수정(children/[id])과 같은 패턴.
export async function PATCH(request: Request) {
  const parent = await getCurrentProfile();
  if (!parent) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (parent.role !== "parent") return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });
  const demoBlock = await demoBlockResponse(parent, "데모 체험 계정에서는 질문 지침을 저장할 수 없어요.");
  if (demoBlock) return demoBlock;

  const { instructions } = await request.json();
  const admin = createAdminClient();

  // null이면 "기본값으로 되돌리기" — 커스텀 지침을 지워서 다음 질문 생성부터 기본 지침을 쓰게 한다.
  if (instructions === null) {
    const { error } = await admin.from("families").update({ custom_stage_instructions: null }).eq("id", parent.family_id);
    if (error) return NextResponse.json({ error: "되돌리지 못했어요." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (typeof instructions !== "object") {
    return NextResponse.json({ error: "지침 내용이 올바르지 않아요." }, { status: 400 });
  }

  const cleaned: Record<string, string> = {};
  for (const stage of STAGES) {
    const value = (instructions as Record<string, unknown>)[String(stage)];
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: `${stage}단계 지침을 입력해주세요.` }, { status: 400 });
    }
    if (value.length > MAX_LENGTH) {
      return NextResponse.json({ error: `지침은 ${MAX_LENGTH}자 이내로 입력해주세요.` }, { status: 400 });
    }
    cleaned[String(stage)] = value.trim();
  }

  const { error } = await admin
    .from("families")
    .update({ custom_stage_instructions: cleaned })
    .eq("id", parent.family_id);

  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
