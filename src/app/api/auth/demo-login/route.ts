import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 회원가입 화면의 "로그인 없이 데모 체험하기" 링크가 호출한다. scripts/seed-demo-account.mjs로
// 미리 만들어둔 읽기 전용 데모 부모 계정(비밀번호는 서버 환경변수에만 있고 클라이언트 코드에는
// 절대 나타나지 않는다)으로 로그인시켜 세션 쿠키를 발급한다. 이후 /profiles에서 데모 자녀
// PIN(demoMode.ts의 DEMO_CHILD_PIN)으로 자녀 화면까지 그대로 체험할 수 있다. 실제 쓰기 작업은
// src/lib/demoMode.ts의 가드가 각 API 라우트에서 막는다.
export async function POST() {
  const email = process.env.DEMO_PARENT_EMAIL;
  const password = process.env.DEMO_PARENT_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "데모 체험이 아직 준비되지 않았어요." }, { status: 503 });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "데모 로그인에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
