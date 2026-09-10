import "server-only";
import crypto from "crypto";

// 헷갈리는 문자(0/O, 1/I/L)를 뺀 6자리 가족 코드. 현재 UI에서는 노출하지 않지만
// families.join_code가 not null unique라 회원가입 시 발급은 필요하다 — twin_choice와
// 스키마를 표준화해두면 향후 자녀 기기 단독 로그인 같은 기능을 그대로 가져올 수 있다.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
