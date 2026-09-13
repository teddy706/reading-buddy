import { describe, expect, it } from "vitest";
import { pickIsbnFromApiField, normalizeIsbnInput } from "@/lib/isbn";

describe("pickIsbnFromApiField", () => {
  it("ISBN-10과 ISBN-13이 공백으로 섞여 있으면 13자리를 우선한다", () => {
    expect(pickIsbnFromApiField("8983920775 9788983920770")).toBe("9788983920770");
  });

  it("순서가 반대여도 자릿수로 구분한다", () => {
    expect(pickIsbnFromApiField("9788983920770 8983920775")).toBe("9788983920770");
  });

  it("13자리가 없으면 10자리를 쓴다", () => {
    expect(pickIsbnFromApiField("8983920775")).toBe("8983920775");
  });

  it("하이픈이 섞여 있어도 정리해서 인식한다", () => {
    expect(pickIsbnFromApiField("978-89-8392-077-0")).toBe("9788983920770");
  });

  it("값이 없으면 null", () => {
    expect(pickIsbnFromApiField(undefined)).toBeNull();
    expect(pickIsbnFromApiField(null)).toBeNull();
    expect(pickIsbnFromApiField("")).toBeNull();
  });
});

describe("normalizeIsbnInput", () => {
  it("하이픈 섞인 13자리를 정리한다", () => {
    expect(normalizeIsbnInput("978-89-8392-077-0")).toBe("9788983920770");
  });

  it("10자리 숫자를 허용한다", () => {
    expect(normalizeIsbnInput("0-306-40619-2")).toBe("0306406192");
  });

  it("10자리의 마지막 검증 문자로 X를 허용한다(대소문자 무관)", () => {
    expect(normalizeIsbnInput("0-19-852663-x")).toBe("019852663X");
  });

  it("10자리도 13자리도 아니면 null", () => {
    expect(normalizeIsbnInput("12345")).toBeNull();
    expect(normalizeIsbnInput("")).toBeNull();
  });
});
