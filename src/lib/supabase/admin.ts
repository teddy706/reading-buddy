import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// 서비스 역할 키를 쓰는 관리자 클라이언트. RLS를 완전히 우회하므로
// app/api/** 의 신뢰된 서버 코드(가족/자녀 프로비저닝, 독서로 자동화, 삭제)에서만 사용한다.
// 절대 클라이언트 컴포넌트나 브라우저로 값을 전달하지 말 것.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
