import path from "path";
import { defineConfig } from "vitest/config";

// 순수 로직(lib/*)에 대한 유닛 테스트만 다룬다 — Next.js 서버 컴포넌트/API 라우트 통합 테스트는
// 범위 밖(지금까지는 실제 브라우저 수동 검증으로 대체해왔고, 이 설정은 그 공백 중 자동화가
// 가장 저렴한 부분부터 메우기 위한 최소 구성이다).
//
// "server-only" 패키지는 react-server 조건이 없는 일반 Node 런타임(=vitest)에서 import되면
// 항상 예외를 던지도록 만들어져 있다(Next.js 빌드에서만 조건부로 empty.js로 치환됨). 그 자체가
// 런타임 로직은 아니므로 테스트에서는 빈 모듈로 바꿔치기한다.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
