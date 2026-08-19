-- VERDANT GIS: Contact / Dataset Request table
-- Run this once in Supabase SQL Editor if the main schema was already applied.

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
alter table public.contact_requests enable row level security;
