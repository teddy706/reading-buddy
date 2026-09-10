import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Supabase Auth 는 이메일 계정 기반이라 이메일이 없는 자녀도 "실제 세션"을 받게 하려면
// profile 마다 synthetic 이메일 계정을 만들어야 한다. 그래야 auth.uid() 가 채워지고
// RLS 정책(my_family_id() 등)이 그대로 동작한다.
//
// 자녀가 입력하는 4자리 PIN 자체를 Supabase Auth 비밀번호로 쓰지 않는다(너무 짧고 추측 쉬움).
// 대신 PIN + profile_id + 서버 전용 CHILD_AUTH_SECRET 을 HMAC-SHA256 으로 섞어
// 매번 동일하게 재현 가능한 고강도 비밀번호를 만들어 로그인/계정생성 양쪽에서 사용한다.
//
// twin_choice 프로젝트와 동일한 패턴(가족 계정: 부모 1명 + 자녀 프로필 N개)을 그대로 따른다 —
// 두 앱이 향후 같은 Supabase 프로젝트/스키마를 재사용할 가능성을 열어두기 위함(PRD 4.1).

export function childProfileEmail(profileId: string) {
  return `child+${profileId}@child.reading-buddy.internal`;
}

export function deriveChildAuthPassword(profileId: string, pin: string) {
  const secret = process.env.CHILD_AUTH_SECRET;
  if (!secret) throw new Error("CHILD_AUTH_SECRET 이 설정되지 않았습니다.");
  return crypto
    .createHmac("sha256", secret)
    .update(`${profileId}:${pin}`)
    .digest("hex");
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

// profiles.pin_hash 는 인증에 쓰이지 않고(위 derive 함수가 실제 비밀번호를 만든다),
// 부모가 자녀 프로필 목록에서 "PIN을 잊었어요" 같은 흐름을 만들 때 대조용으로만 쓴다.
export async function hashPinForDisplay(pin: string) {
  return bcrypt.hash(pin, 10);
}
