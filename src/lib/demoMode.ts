import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// 회원가입 화면의 "데모 체험하기"로 로그인하는 읽기 전용 체험 계정. 실제 계정과 완전히
// 같은 화면/기능을 그대로 보여주되, 자녀 프로필 삭제·PIN 변경·기록 수정 같은 "되돌릴 수
// 없는 쓰기" 작업만 API 라우트 단에서 막는다(demoBlockResponse). 대화형 AI 질문/감상문
// 생성은 이 앱의 핵심 기능이라 예외적으로 허용한다(사용자 확인 완료, 2026-09-15) — 대신
// 저장(reading-sessions/[id]/finish)만은 실제 reading_records를 남기지 않는다.
//
// 시딩은 scripts/seed-demo-account.mjs. 이 파일의 DEMO_CHILD_PIN은 그 스크립트가 만드는
// 값과 반드시 같아야 한다(/profiles 화면의 안내 문구가 이 상수를 그대로 보여준다).
export const DEMO_CHILD_PIN = "1234";

export async function isDemoFamily(familyId: string, supabase = createClient()): Promise<boolean> {
  const { data } = await supabase.from("families").select("is_demo").eq("id", familyId).maybeSingle();
  return data?.is_demo === true;
}

const DEFAULT_DEMO_BLOCK_MESSAGE = "데모 체험 계정에서는 둘러보기만 할 수 있어요. 저장·수정은 실제 계정을 만들면 할 수 있어요.";

// 쓰기 작업을 하는 API 라우트 맨 앞에서 호출한다 — 데모 가족이면 403을 돌려주고,
// 호출한 라우트는 그 응답을 그대로 반환하면 된다(기존 error 상태 UI가 그대로 메시지를 보여준다).
export async function demoBlockResponse(
  profile: Pick<Profile, "family_id">,
  message = DEFAULT_DEMO_BLOCK_MESSAGE
): Promise<NextResponse | null> {
  if (await isDemoFamily(profile.family_id)) {
    return NextResponse.json({ error: message, demo: true }, { status: 403 });
  }
  return null;
}
