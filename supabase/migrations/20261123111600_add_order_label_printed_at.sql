alter table public.orders
  add column if not exists printed_at timestamptz;
