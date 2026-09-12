import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PIN_LOCK_DURATION_MS,
  PIN_MAX_ATTEMPTS,
  childProfileEmail,
  deriveChildAuthPassword,
  hashPinForDisplay,
  isPinLocked,
  isValidPin,
} from "@/lib/childAuth";
import bcrypt from "bcryptjs";

describe("isValidPin", () => {
  it("숫자 4자리만 통과시킨다", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("0000")).toBe(true);
  });

  it("4자리가 아니거나 숫자가 아니면 거부한다", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
    expect(isValidPin(" 1234")).toBe(false);
  });
});

describe("isPinLocked", () => {
  it("pin_locked_until이 없으면 잠기지 않은 것으로 본다", () => {
    expect(isPinLocked({ pin_locked_until: null })).toBe(false);
  });

  it("pin_locked_until이 미래면 잠긴 것으로 본다", () => {
    const future = new Date(Date.now() + 30_000).toISOString();
    expect(isPinLocked({ pin_locked_until: future })).toBe(true);
  });

  it("pin_locked_until이 과거면 잠금이 풀린 것으로 본다", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isPinLocked({ pin_locked_until: past })).toBe(false);
  });
});

describe("PIN 잠금 정책 상수 (PRD 3.1)", () => {
  it("5회 실패 시 1분 잠금", () => {
    expect(PIN_MAX_ATTEMPTS).toBe(5);
    expect(PIN_LOCK_DURATION_MS).toBe(60_000);
  });
});

describe("childProfileEmail", () => {
  it("profile_id를 그대로 담은 synthetic 이메일을 만든다", () => {
    expect(childProfileEmail("abc-123")).toBe("child+abc-123@child.reading-buddy.internal");
  });
});

describe("deriveChildAuthPassword", () => {
  const ORIGINAL_SECRET = process.env.CHILD_AUTH_SECRET;

  beforeEach(() => {
    process.env.CHILD_AUTH_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.CHILD_AUTH_SECRET = ORIGINAL_SECRET;
  });

  it("같은 profileId+pin+secret이면 매번 같은 비밀번호를 만든다(결정론적)", () => {
    const a = deriveChildAuthPassword("profile-1", "1234");
    const b = deriveChildAuthPassword("profile-1", "1234");
    expect(a).toBe(b);
  });

  it("profileId나 pin이 다르면 다른 비밀번호가 나온다", () => {
    const base = deriveChildAuthPassword("profile-1", "1234");
    expect(deriveChildAuthPassword("profile-2", "1234")).not.toBe(base);
    expect(deriveChildAuthPassword("profile-1", "5678")).not.toBe(base);
  });

  it("CHILD_AUTH_SECRET이 다르면 다른 비밀번호가 나온다(salt 역할)", () => {
    const withSecretA = deriveChildAuthPassword("profile-1", "1234");
    process.env.CHILD_AUTH_SECRET = "other-secret";
    const withSecretB = deriveChildAuthPassword("profile-1", "1234");
    expect(withSecretA).not.toBe(withSecretB);
  });

  it("CHILD_AUTH_SECRET이 없으면 에러를 던진다", () => {
    delete process.env.CHILD_AUTH_SECRET;
    expect(() => deriveChildAuthPassword("profile-1", "1234")).toThrow();
  });
});

describe("hashPinForDisplay", () => {
  it("bcrypt로 해시해서 원래 PIN과 대조 가능하게 만든다", async () => {
    const hash = await hashPinForDisplay("1234");
    expect(hash).not.toBe("1234");
    await expect(bcrypt.compare("1234", hash)).resolves.toBe(true);
    await expect(bcrypt.compare("9999", hash)).resolves.toBe(false);
  });

  it("같은 PIN이라도 매번 다른 해시(salt)를 만든다", async () => {
    const [a, b] = await Promise.all([hashPinForDisplay("1234"), hashPinForDisplay("1234")]);
    expect(a).not.toBe(b);
  });
});
