-- VERDANT GIS V14 ADMIN SETUP
-- Run after your existing schema.sql and storage.sql.
-- NO sample datasets, orders or customers are inserted here.
--
-- STEP 1: replace YOUR_ADMIN_EMAIL@example.com below with your real admin email.
-- STEP 2: run this entire file in Supabase SQL Editor.
-- STEP 3: if the Auth account already existed, also run the promotion UPDATE.

create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

-- ============================================================
-- ADMIN EMAIL
-- ============================================================

insert into public.admin_allowlist(email)
values (lower('YOUR_ADMIN_EMAIL@example.com'))
on conflict (email) do nothing;

-- ============================================================
-- NEW USER -> CUSTOMER OR ADMIN
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text := 'customer';
begin
  if exists (
    select 1
    from public.admin_allowlist a
    where lower(a.email) = lower(new.email)
  ) then
    assigned_role := 'admin';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    assigned_role
  )
  on conflict (id) do update
    set full_name = coalesce(
      excluded.full_name,
      public.profiles.full_name
    ),
    role = case
      when exists (
        select 1
        from public.admin_allowlist a
        where lower(a.email) = lower(new.email)
      )
      then 'admin'
      else public.profiles.role
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ============================================================
-- EXISTING ADMIN ACCOUNT
-- ============================================================
-- If your admin Auth account was created BEFORE this SQL was run,
-- execute this AFTER the INSERT above:
--
-- update public.profiles p
-- set role = 'admin'
-- from auth.users u
-- where p.id = u.id
--   and lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');

-- ============================================================
-- ADMIN DATASET POLICIES
-- ============================================================

alter table public.datasets enable row level security;

drop policy if exists "Admins can insert datasets" on public.datasets;
create policy "Admins can insert datasets"
on public.datasets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update datasets" on public.datasets;
create policy "Admins can update datasets"
on public.datasets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can delete datasets" on public.datasets;
create policy "Admins can delete datasets"
on public.datasets
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Verify after creating/logging in as the admin:
-- select p.id, u.email, p.full_name, p.role
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');
