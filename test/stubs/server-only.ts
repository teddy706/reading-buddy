// vitest.config.ts가 "server-only" import를 이 파일로 치환한다. 실제 패키지는
// react-server 조건이 없는 런타임(=Node/vitest)에서 import되면 항상 예외를 던지도록
// 만들어져 있는데, 그건 "클라이언트 번들에 실수로 섞여 들어가는 것"을 막기 위한 빌드 타임
// 가드일 뿐 테스트 대상 로직이 아니라서, 테스트에서는 아무 것도 하지 않는 빈 모듈로 대체한다.
export {};
