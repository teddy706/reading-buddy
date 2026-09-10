import { createBrowserClient } from "@supabase/ssr";

// 손으로 쓴 Database 타입 대신 `supabase gen types typescript`로 생성한 정식 타입으로
// 나중에 교체하는 걸 권장한다. 지금은 src/lib/types.ts 의 인터페이스로 각 쿼리 결과를 직접 타입 지정한다.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
