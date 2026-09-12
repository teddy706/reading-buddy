import { describe, expect, it } from "vitest";
import { dedupeCandidates } from "@/lib/bookSearch";
import type { BookCandidate } from "@/lib/kakaoBook";

function candidate(overrides: Partial<BookCandidate> = {}): BookCandidate {
  return {
    title: "무지개 물고기",
    author: "마르쿠스 피스터",
    thumbnail: null,
    description: null,
    ...overrides,
  };
}

describe("dedupeCandidates", () => {
  it("제목+저자가 같으면 하나만 남긴다", () => {
    const result = dedupeCandidates([candidate(), candidate()]);
    expect(result).toHaveLength(1);
  });

  it("대소문자/공백 차이는 같은 책으로 취급한다", () => {
    const result = dedupeCandidates([candidate({ title: " 무지개 물고기 " }), candidate({ title: "무지개 물고기" })]);
    expect(result).toHaveLength(1);
  });

  it("저자가 다르면 다른 책으로 취급한다(동명이책)", () => {
    const result = dedupeCandidates([candidate({ author: "저자 A" }), candidate({ author: "저자 B" })]);
    expect(result).toHaveLength(2);
  });

  it("먼저 나온 후보(카카오 결과)를 우선 유지한다", () => {
    const first = candidate({ description: "카카오 설명" });
    const second = candidate({ description: "네이버 설명" });
    const result = dedupeCandidates([first, second]);
    expect(result[0].description).toBe("카카오 설명");
  });

  it("겹치는 게 없으면 순서를 유지한 채 그대로 돌려준다", () => {
    const a = candidate({ title: "책 A" });
    const b = candidate({ title: "책 B" });
    expect(dedupeCandidates([a, b])).toEqual([a, b]);
  });
});
