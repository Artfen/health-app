-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES (all created before any cross-reference RLS policies)
-- ============================================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  garmin_connected boolean default false,
  garmin_display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.garmin_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade unique not null,
  oauth1_token jsonb,
  oauth2_token jsonb,
  garmin_profile jsonb,
  updated_at timestamptz default now()
);

create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users on delete cascade not null,
  invite_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  created_at timestamptz default now()
);

create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

create table public.health_snapshots (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  steps integer,
  calories integer,
  active_calories integer,
  resting_hr integer,
  avg_stress integer,
  body_battery_high integer,
  body_battery_low integer,
  sleep_seconds integer,
  deep_sleep_seconds integer,
  rem_sleep_seconds integer,
  sleep_score integer,
  hrv_last_night numeric,
  hrv_status text,
  distance_meters integer,
  active_seconds integer,
  synced_at timestamptz default now(),
  unique(user_id, date)
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.garmin_tokens enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.health_snapshots enable row level security;

-- profiles
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Group members can view each other's profiles"
  on public.profiles for select using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

-- garmin_tokens
create policy "Users can only access their own tokens"
  on public.garmin_tokens for all using (auth.uid() = user_id);

-- groups
create policy "Group members can view their groups"
  on public.groups for select using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid()
    )
  );

create policy "Users can create groups"
  on public.groups for insert with check (auth.uid() = owner_id);

create policy "Group owners can update their groups"
  on public.groups for update using (auth.uid() = owner_id);

-- group_members
create policy "Users can view memberships in their groups"
  on public.group_members for select using (
    user_id = auth.uid() or
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "Users can join groups"
  on public.group_members for insert with check (auth.uid() = user_id);

create policy "Users can leave groups"
  on public.group_members for delete using (auth.uid() = user_id);

-- health_snapshots
create policy "Users can view their own snapshots"
  on public.health_snapshots for select using (auth.uid() = user_id);

create policy "Users can insert their own snapshots"
  on public.health_snapshots for insert with check (auth.uid() = user_id);

create policy "Users can update their own snapshots"
  on public.health_snapshots for update using (auth.uid() = user_id);

create policy "Group members can view each other's snapshots"
  on public.health_snapshots for select using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = health_snapshots.user_id
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
