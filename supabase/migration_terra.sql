-- Add Terra fields to profiles
alter table public.profiles
  add column if not exists terra_user_id text unique,
  add column if not exists terra_provider text,
  add column if not exists terra_connected boolean default false;

-- Allow lookup by terra_user_id (used in webhook handler)
create index if not exists profiles_terra_user_id_idx on public.profiles(terra_user_id);
