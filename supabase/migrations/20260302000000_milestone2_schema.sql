-- Milestone 2: Core schema for profiles, closets, clothing items, item images,
-- and many-to-many closet assignment.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_length check (username is null or char_length(trim(username)) between 3 and 32)
);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.closets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cover_image_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint closets_name_not_empty check (char_length(trim(name)) > 0)
);

create unique index if not exists closets_user_name_unique_idx
  on public.closets (user_id, lower(name));

create index if not exists closets_user_id_idx on public.closets(user_id);

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_image_path text not null,
  brand text,
  price_amount numeric(12,2),
  price_currency text default 'USD',
  clothing_type text,
  color text,
  season text[],
  material text[],
  custom_fields jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clothing_items_name_not_empty check (char_length(trim(name)) > 0),
  constraint clothing_items_price_non_negative check (price_amount is null or price_amount >= 0),
  constraint clothing_items_custom_fields_object check (custom_fields is null or jsonb_typeof(custom_fields) = 'object')
);

create index if not exists clothing_items_user_id_idx on public.clothing_items(user_id);
create index if not exists clothing_items_type_idx on public.clothing_items(clothing_type);
create index if not exists clothing_items_color_idx on public.clothing_items(color);

create table if not exists public.clothing_item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.clothing_items(id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint clothing_item_images_sort_order_non_negative check (sort_order >= 0)
);

create index if not exists clothing_item_images_item_id_idx on public.clothing_item_images(item_id);
create index if not exists clothing_item_images_item_sort_idx on public.clothing_item_images(item_id, sort_order);

create table if not exists public.clothing_item_closets (
  item_id uuid not null references public.clothing_items(id) on delete cascade,
  closet_id uuid not null references public.closets(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (item_id, closet_id)
);

create index if not exists clothing_item_closets_item_id_idx on public.clothing_item_closets(item_id);
create index if not exists clothing_item_closets_closet_id_idx on public.clothing_item_closets(closet_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists closets_set_updated_at on public.closets;
create trigger closets_set_updated_at
before update on public.closets
for each row execute function public.set_updated_at();

drop trigger if exists clothing_items_set_updated_at on public.clothing_items;
create trigger clothing_items_set_updated_at
before update on public.clothing_items
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.closets enable row level security;
alter table public.clothing_items enable row level security;
alter table public.clothing_item_images enable row level security;
alter table public.clothing_item_closets enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "closets_select_own" on public.closets;
create policy "closets_select_own"
on public.closets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "closets_insert_own" on public.closets;
create policy "closets_insert_own"
on public.closets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "closets_update_own" on public.closets;
create policy "closets_update_own"
on public.closets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "closets_delete_own" on public.closets;
create policy "closets_delete_own"
on public.closets
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "clothing_items_select_own" on public.clothing_items;
create policy "clothing_items_select_own"
on public.clothing_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "clothing_items_insert_own" on public.clothing_items;
create policy "clothing_items_insert_own"
on public.clothing_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "clothing_items_update_own" on public.clothing_items;
create policy "clothing_items_update_own"
on public.clothing_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "clothing_items_delete_own" on public.clothing_items;
create policy "clothing_items_delete_own"
on public.clothing_items
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "clothing_item_images_select_own" on public.clothing_item_images;
create policy "clothing_item_images_select_own"
on public.clothing_item_images
for select
to authenticated
using (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_images.item_id
      and ci.user_id = auth.uid()
  )
);

drop policy if exists "clothing_item_images_insert_own" on public.clothing_item_images;
create policy "clothing_item_images_insert_own"
on public.clothing_item_images
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_images.item_id
      and ci.user_id = auth.uid()
  )
);

drop policy if exists "clothing_item_images_update_own" on public.clothing_item_images;
create policy "clothing_item_images_update_own"
on public.clothing_item_images
for update
to authenticated
using (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_images.item_id
      and ci.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_images.item_id
      and ci.user_id = auth.uid()
  )
);

drop policy if exists "clothing_item_images_delete_own" on public.clothing_item_images;
create policy "clothing_item_images_delete_own"
on public.clothing_item_images
for delete
to authenticated
using (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_images.item_id
      and ci.user_id = auth.uid()
  )
);

drop policy if exists "clothing_item_closets_select_own" on public.clothing_item_closets;
create policy "clothing_item_closets_select_own"
on public.clothing_item_closets
for select
to authenticated
using (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_closets.item_id
      and ci.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.closets c
    where c.id = clothing_item_closets.closet_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "clothing_item_closets_insert_own" on public.clothing_item_closets;
create policy "clothing_item_closets_insert_own"
on public.clothing_item_closets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_closets.item_id
      and ci.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.closets c
    where c.id = clothing_item_closets.closet_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "clothing_item_closets_delete_own" on public.clothing_item_closets;
create policy "clothing_item_closets_delete_own"
on public.clothing_item_closets
for delete
to authenticated
using (
  exists (
    select 1
    from public.clothing_items ci
    where ci.id = clothing_item_closets.item_id
      and ci.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.closets c
    where c.id = clothing_item_closets.closet_id
      and c.user_id = auth.uid()
  )
);

