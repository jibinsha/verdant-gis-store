-- VERDANT GIS STORE v9
-- Run this AFTER your existing schema.sql in Supabase SQL Editor.

alter table public.orders
  add column if not exists razorpay_order_id text unique,
  add column if not exists razorpay_payment_id text unique,
  add column if not exists razorpay_signature text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_razorpay_order_idx
  on public.orders(razorpay_order_id);

create table if not exists public.razorpay_webhook_events (
  id text primary key,
  event_type text,
  created_at timestamptz not null default now()
);

alter table public.razorpay_webhook_events enable row level security;

-- No public/authenticated policies are intentionally created.
-- The backend uses the Supabase service-role key for webhook/order processing.

create unique index if not exists downloads_user_dataset_unique
  on public.downloads(user_id, dataset_id);
