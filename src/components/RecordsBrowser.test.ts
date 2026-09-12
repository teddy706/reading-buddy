import { describe, expect, it } from "vitest";
import { toIlikePattern } from "@/components/RecordsBrowser";

describe("toIlikePattern", () => {
  it("검색어를 %로 감싼 패턴으로 만든다", () => {
    expect(toIlikePattern("무지개")).toBe('"%무지개%"');
  });

  it("LIKE 와일드카드(%, _)를 이스케이프한다", () => {
    expect(toIlikePattern("100%")).toBe('"%100\\%%"');
    expect(toIlikePattern("어_제")).toBe('"%어\\_제%"');
  });

  it("or() 필터 문법과 충돌하는 큰따옴표를 이스케이프한다", () => {
    expect(toIlikePattern('"인용"')).toBe('"%\\"인용\\"%"');
  });
});
