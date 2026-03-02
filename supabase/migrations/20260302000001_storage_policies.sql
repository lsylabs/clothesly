-- Milestone 2: Storage buckets and RLS for user-scoped media.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('closets', 'closets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('items', 'items', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closets_select_own" on storage.objects;
create policy "closets_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'closets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closets_insert_own" on storage.objects;
create policy "closets_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'closets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closets_update_own" on storage.objects;
create policy "closets_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'closets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'closets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closets_delete_own" on storage.objects;
create policy "closets_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'closets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "items_select_own" on storage.objects;
create policy "items_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "items_insert_own" on storage.objects;
create policy "items_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "items_update_own" on storage.objects;
create policy "items_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "items_delete_own" on storage.objects;
create policy "items_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
);

