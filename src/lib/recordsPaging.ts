// RecordsBrowser(클라이언트 컴포넌트)와 그걸 렌더링하는 서버 페이지(records/page.tsx,
// settings/records/page.tsx)가 페이지 크기를 공유해야 하는데, "use client" 파일에서 export한
// 상수를 서버 컴포넌트가 import해서 산술 연산에 쓰면(RECORDS_PAGE_SIZE - 1) 클라이언트 경계
// 때문에 실제 숫자가 아니라 참조 객체를 받아 NaN이 되고, 그 결과 .range(0, NaN)이 PostgREST에서
// 빈 결과로 돌아온다 — 기록이 있는데도 "아직 기록한 책이 없어요"로 보이는 원인이었다.
// "use client" 지시어가 없는 별도 모듈로 분리해 양쪽 다 안전하게 import한다.
export const RECORDS_PAGE_SIZE = 15;
