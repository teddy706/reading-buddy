-- 자녀 아바타 사진 업로드. 기존 이모지 아바타(profiles.avatar)는 그대로 유지하고,
-- avatar_photo_path가 있으면 그걸 이모지 대신 보여준다(선택적 override).
--
-- 버킷은 비공개로 두고(자녀 얼굴 사진이라 reading-notes와 같은 수준의 보호), 화면에 보여줄 때마다
-- 서명된 URL을 새로 발급한다(src/lib/avatarPhoto.ts). 경로 규칙: {family_id}/{profile_id}
-- (파일명 자체가 profile_id, 확장자 없음) — 항상 upsert로 덮어써서 재업로드 시 이전 파일이
-- 남지 않는다. reading-notes와 달리 조회는 "같은 가족이면 누구나"(기존 이모지 아바타도
-- profiles RLS상 가족 구성원끼리는 서로 볼 수 있었으므로 동일한 공개 범위 유지), 업로드/교체/삭제는
-- 부모만 가능(자녀 프로필 이름/이모지 수정과 동일한 권한 모델).

alter table profiles add column if not exists avatar_photo_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_storage_select on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.my_family_id()::text
  );

create policy avatars_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.my_family_id()::text
    and public.my_role() = 'parent'
  );

create policy avatars_storage_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.my_family_id()::text
    and public.my_role() = 'parent'
  );

create policy avatars_storage_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.my_family_id()::text
    and public.my_role() = 'parent'
  );
