alter table public.profiles
add column if not exists full_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_full_name_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_full_name_length
      check (full_name is null or char_length(trim(full_name)) between 1 and 120);
  end if;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_full_name text;
begin
  incoming_full_name := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    ''
  );

  insert into public.profiles (id, full_name)
  values (new.id, incoming_full_name)
  on conflict (id) do update
  set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;
