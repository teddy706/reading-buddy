import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Component / Route Handler 에서 현재 로그인 사용자의 세션으로 Supabase 를 호출한다.
// RLS 가 유일한 접근 제어이므로 이 클라이언트는 anon key 로만 동작한다.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component 에서 호출된 경우 무시 (미들웨어가 세션 갱신을 담당)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // 위와 동일한 이유로 무시
          }
        },
      },
    }
  );
}
