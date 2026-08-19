-- VERDANT GIS STORE v2
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.dataset_status as enum ('draft','published','archived');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  location text,
  coverage text,
  price numeric(12,2) not null default 0,
  currency text not null default 'INR',
  formats text[] not null default '{}',
  feature_count text,
  crs text default 'EPSG:4326',
  file_size text,
  source text,
  updated_label text,
  thumbnail_url text,
  preview_geojson_url text,
  download_path text,
  status public.dataset_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete restrict,
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  download_count integer not null default 0,
  last_downloaded_at timestamptz
);

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, phone text, organization text,
  request_type text not null default 'Dataset request', dataset_area text, coverage text,
  preferred_format text, message text not null,
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  created_at timestamptz not null default now()
);
create index if not exists contact_requests_created_idx on public.contact_requests(created_at desc);
create index if not exists contact_requests_status_idx on public.contact_requests(status);

create index if not exists datasets_category_idx on public.datasets(category_id);
create index if not exists datasets_status_idx on public.datasets(status);
create index if not exists datasets_slug_idx on public.datasets(slug);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists downloads_user_idx on public.downloads(user_id);

-- Profiles trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.datasets enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.downloads enable row level security;
alter table public.contact_requests enable row level security;

create policy "Public can read published datasets"
on public.datasets for select
using (status = 'published');

create policy "Public can read categories"
on public.categories for select
using (true);

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Users read own orders"
on public.orders for select
using (auth.uid() = user_id);

create policy "Users read own order items"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

create policy "Users read own downloads"
on public.downloads for select
using (auth.uid() = user_id);

-- Seed categories
insert into public.categories (name, slug) values
('Agriculture','agriculture'),
('Remote Sensing','remote-sensing'),
('Soil','soil'),
('Administrative','administrative'),
('Transport','transport'),
('Terrain','terrain'),
('Water Resources','water-resources')
on conflict (slug) do nothing;
