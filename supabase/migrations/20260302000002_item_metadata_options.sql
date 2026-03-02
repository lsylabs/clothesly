-- User-defined metadata options for add-item selectors.

create table if not exists public.item_metadata_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  label text not null,
  label_normalized text generated always as (lower(trim(label))) stored,
  created_at timestamptz not null default timezone('utc', now()),
  constraint item_metadata_options_label_not_empty check (char_length(trim(label)) > 0),
  constraint item_metadata_options_category_valid check (category in ('brand', 'clothing_type', 'color', 'material', 'season'))
);

create index if not exists item_metadata_options_user_category_idx
  on public.item_metadata_options (user_id, category);

create unique index if not exists item_metadata_options_user_category_label_unique_idx
  on public.item_metadata_options (user_id, category, label_normalized);

alter table public.item_metadata_options enable row level security;

drop policy if exists "item_metadata_options_select_own" on public.item_metadata_options;
create policy "item_metadata_options_select_own"
on public.item_metadata_options
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "item_metadata_options_insert_own" on public.item_metadata_options;
create policy "item_metadata_options_insert_own"
on public.item_metadata_options
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "item_metadata_options_delete_own" on public.item_metadata_options;
create policy "item_metadata_options_delete_own"
on public.item_metadata_options
for delete
to authenticated
using (auth.uid() = user_id);