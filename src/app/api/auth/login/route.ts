import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
