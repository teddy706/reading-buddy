// 페이지 수를 자동으로 채워줄 API가 없다(카카오·도서관정보나루는 필드 자체가 없고, 네이버 도서
// 검색 오픈API는 서비스 종료 — CLAUDE.md "책 제목 검색" 절 참고). 네이버쇼핑의 책 카탈로그
// 페이지(예: search.shopping.naver.com/book/catalog/...)에는 "쪽수/무게/크기"가 잘 나와 있지만,
// 이건 개발자 API로 공개된 데이터가 아니라 사람이 보는 쇼핑 페이지의 상품 스펙이다. 서버가 그
// 페이지를 대신 긁어오면(스크래핑) 이용약관 위반 소지가 있고 실제로도 자동 요청이 차단되는
// 것을 확인했다 — 이 앱이 '독서로' 자동 등록 대신 "사람이 직접 확인" 방식을 택한 것과 같은
// 이유로, 페이지 수도 검색 링크만 열어주고 사람이 보고 직접 입력하게 한다.
export function naverBookSearchUrl(title: string, author?: string | null): string {
  const query = [title.trim(), author?.trim()].filter(Boolean).join(" ");
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`;
}
