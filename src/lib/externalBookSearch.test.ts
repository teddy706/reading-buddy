import { describe, expect, it } from "vitest";
import { naverBookSearchUrl } from "@/lib/externalBookSearch";

describe("naverBookSearchUrl", () => {
  it("제목만 있으면 제목으로 검색 URL을 만든다", () => {
    const url = naverBookSearchUrl("무지개 물고기");
    expect(url).toBe(`https://search.shopping.naver.com/search/all?query=${encodeURIComponent("무지개 물고기")}`);
  });

  it("저자가 있으면 제목과 함께 검색어에 포함한다", () => {
    const url = naverBookSearchUrl("강아지똥", "권정생");
    expect(url).toContain(encodeURIComponent("강아지똥 권정생"));
  });

  it("제목/저자 앞뒤 공백은 제거한다", () => {
    const url = naverBookSearchUrl("  강아지똥  ", "  ");
    expect(url).toBe(`https://search.shopping.naver.com/search/all?query=${encodeURIComponent("강아지똥")}`);
  });
});
