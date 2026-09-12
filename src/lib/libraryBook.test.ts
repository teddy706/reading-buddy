import { describe, expect, it } from "vitest";
import { firstAuthor } from "@/lib/libraryBook";

describe("firstAuthor", () => {
  it("첫 번째 사람만 뽑는다", () => {
    expect(firstAuthor("마르쿠스 피스터|공경희")).toBe("마르쿠스 피스터");
  });

  it("역할 표기(지음/글/그림/저/엮음)를 정리한다", () => {
    expect(firstAuthor("마르쿠스 피스터 지음")).toBe("마르쿠스 피스터");
    expect(firstAuthor("이억배 글")).toBe("이억배");
    expect(firstAuthor("이억배 그림")).toBe("이억배");
    expect(firstAuthor("톨스토이 저")).toBe("톨스토이");
    expect(firstAuthor("국립국어원 엮음")).toBe("국립국어원");
  });

  it("쉼표/세미콜론 구분자도 처리한다", () => {
    expect(firstAuthor("김철수,이영희")).toBe("김철수");
    expect(firstAuthor("김철수;이영희")).toBe("김철수");
  });

  it("빈 문자열이나 역할 표기만 남으면 null을 돌려준다", () => {
    expect(firstAuthor("")).toBeNull();
    expect(firstAuthor("지음")).toBeNull();
  });
});
