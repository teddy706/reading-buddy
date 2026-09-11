import type { SupabaseClient } from "@supabase/supabase-js";

// 서버/클라이언트 양쪽에서 쓴다(경로 규칙은 업로드 시 클라이언트에서도 필요) — 비밀값을 다루지
//않으므로 "server-only"로 막지 않는다. 실제 RLS 강제는 storage.objects 정책이 전담한다.
export const AVATAR_PHOTO_BUCKET = "avatars";

// 파일명 자체가 profile_id, 확장자 없음 — 항상 upsert로 덮어써서 재업로드 시 이전 파일이 안 남는다.
export function avatarPhotoPath(familyId: string, profileId: string): string {
  return `${familyId}/${profileId}`;
}

// 버킷이 비공개라 화면에 보여줄 때마다 서명된 URL을 새로 발급해야 한다. 매 페이지 렌더(서버
// 컴포넌트)마다 새로 호출되므로 만료 시간을 길게 둬도(7일) 문제없다 — 어차피 다음 방문 때 새로 받는다.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function getAvatarPhotoUrl(
  supabase: SupabaseClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(AVATAR_PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

// 자녀 목록 화면(프로필 선택, 부모 대시보드 등)에서 여러 명을 한 번에 조회할 때 쓴다.
export async function getAvatarPhotoUrls(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const validPaths = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const map = new Map<string, string>();
  if (validPaths.length === 0) return map;

  const { data } = await supabase.storage.from(AVATAR_PHOTO_BUCKET).createSignedUrls(validPaths, SIGNED_URL_TTL_SECONDS);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}
