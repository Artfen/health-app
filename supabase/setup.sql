-- ============================================================
-- PulseSync — full Supabase setup
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Safe to run once on a fresh project.
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  garmin_connected boolean default false,
  garmin_display_name text,
  -- Terra fields
  terra_user_id text unique,
  terra_provider text,
  terra_connected boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_terra_user_id_idx on public.profiles(terra_user_id);

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

create table public.objectives (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  target_date date,
  status text default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz default now()
);

-- Transient store for the in-progress Garmin 2FA login flow (cookie jar + CSRF
-- token), bridging the credentials request and the code-verification request.
create table public.garmin_mfa_sessions (
  user_id uuid references auth.users on delete cascade primary key,
  mfa_state jsonb not null,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.garmin_tokens enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.health_snapshots enable row level security;
alter table public.objectives enable row level security;
-- RLS on with no policies: only the service-role key (server-side) can access it.
alter table public.garmin_mfa_sessions enable row level security;

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

-- objectives
create policy "Users can manage their own objectives"
  on public.objectives for all using (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create a profile row when a new auth user signs up
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

-- Keep profiles.updated_at fresh
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

-- ============================================================
-- v2 FEATURES: manual logging, training calendar, injuries, teams
-- (kept at the end so cross-referencing RLS policies see every table)
-- ============================================================

-- Feature 1: manual data entry — distinguish manual snapshots from Garmin syncs.
alter table public.health_snapshots
  add column if not exists source text default 'garmin';

-- Feature 2: training calendar (the AI coach can manage these).
create table public.training_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  title text not null,
  type text,
  description text,
  duration_min integer,
  intensity text,
  status text default 'planned' check (status in ('planned', 'completed', 'skipped')),
  created_by text default 'user' check (created_by in ('user', 'coach')),
  created_at timestamptz default now()
);
create index if not exists training_sessions_user_date_idx on public.training_sessions(user_id, date);

-- Feature 3: injuries.
create table public.injuries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  body_part text not null,
  description text,
  severity text default 'moderate' check (severity in ('mild', 'moderate', 'severe')),
  status text default 'active' check (status in ('active', 'resolved')),
  started_on date default current_date,
  resolved_on date,
  created_at timestamptz default now()
);
create index if not exists injuries_user_status_idx on public.injuries(user_id, status);

-- Feature 5: teams (coach → athletes).
create table public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users on delete cascade not null,
  join_code text unique not null default upper(substring(md5(random()::text), 1, 6)),
  created_at timestamptz default now()
);
create table public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'athlete' check (role in ('coach', 'athlete')),
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

alter table public.training_sessions enable row level security;
alter table public.injuries enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "Users manage own training sessions"
  on public.training_sessions for all using (auth.uid() = user_id);

create policy "Coaches view athlete training"
  on public.training_sessions for select using (
    exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = training_sessions.user_id and t.owner_id = auth.uid()
    )
  );

create policy "Users manage own injuries"
  on public.injuries for all using (auth.uid() = user_id);

create policy "Team members can view their team"
  on public.teams for select using (
    auth.uid() = owner_id or exists (
      select 1 from public.team_members where team_id = teams.id and user_id = auth.uid()
    )
  );
create policy "Users can create teams"
  on public.teams for insert with check (auth.uid() = owner_id);
create policy "Owners can update their teams"
  on public.teams for update using (auth.uid() = owner_id);

create policy "Members can view team membership"
  on public.team_members for select using (
    user_id = auth.uid() or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );
create policy "Users can join teams"
  on public.team_members for insert with check (auth.uid() = user_id);
create policy "Users can leave teams"
  on public.team_members for delete using (auth.uid() = user_id);

-- Coaches can read their athletes' snapshots and profiles for the team dashboard.
create policy "Coaches view athlete snapshots"
  on public.health_snapshots for select using (
    exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = health_snapshots.user_id and t.owner_id = auth.uid()
    )
  );
create policy "Coaches view athlete profiles"
  on public.profiles for select using (
    exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = profiles.id and t.owner_id = auth.uid()
    )
  );
