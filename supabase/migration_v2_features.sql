-- ============================================================
-- v2 feature set: manual logging, training calendar, injuries, teams
-- Run this whole file in the Supabase SQL Editor.
-- Safe to run (and re-run) on top of the existing schema.
-- ============================================================

-- ------------------------------------------------------------
-- TABLES (create everything first, so cross-referencing RLS
-- policies below can always see the tables they depend on)
-- ------------------------------------------------------------

-- Feature 1: manual data entry — mark where a snapshot came from so manual
-- entries (no wearable) and Garmin syncs can coexist.
alter table public.health_snapshots
  add column if not exists source text default 'garmin';

-- Feature 2: training calendar. The AI coach can create/modify/remove these.
create table if not exists public.training_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  title text not null,
  type text,                      -- run | strength | recovery | mobility | cardio | rest | other
  description text,
  duration_min integer,
  intensity text,                 -- easy | moderate | hard
  status text default 'planned' check (status in ('planned', 'completed', 'skipped')),
  created_by text default 'user' check (created_by in ('user', 'coach')),
  created_at timestamptz default now()
);
create index if not exists training_sessions_user_date_idx
  on public.training_sessions(user_id, date);

-- Feature 3: injuries. The coach keeps these in account until resolved.
create table if not exists public.injuries (
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
create index if not exists injuries_user_status_idx
  on public.injuries(user_id, status);

-- Feature 5: teams (coach / personal trainer → athletes), joined via a short code.
create table if not exists public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users on delete cascade not null,
  join_code text unique not null default upper(substring(md5(random()::text), 1, 6)),
  created_at timestamptz default now()
);

create table if not exists public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'athlete' check (role in ('coach', 'athlete')),
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.training_sessions enable row level security;
alter table public.injuries enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- training_sessions
drop policy if exists "Users manage own training sessions" on public.training_sessions;
create policy "Users manage own training sessions"
  on public.training_sessions for all using (auth.uid() = user_id);

drop policy if exists "Coaches view athlete training" on public.training_sessions;
create policy "Coaches view athlete training"
  on public.training_sessions for select using (
    exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = training_sessions.user_id and t.owner_id = auth.uid()
    )
  );

-- injuries
drop policy if exists "Users manage own injuries" on public.injuries;
create policy "Users manage own injuries"
  on public.injuries for all using (auth.uid() = user_id);

-- teams
drop policy if exists "Team members can view their team" on public.teams;
create policy "Team members can view their team"
  on public.teams for select using (
    auth.uid() = owner_id or exists (
      select 1 from public.team_members where team_id = teams.id and user_id = auth.uid()
    )
  );

drop policy if exists "Users can create teams" on public.teams;
create policy "Users can create teams"
  on public.teams for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their teams" on public.teams;
create policy "Owners can update their teams"
  on public.teams for update using (auth.uid() = owner_id);

-- team_members
drop policy if exists "Members can view team membership" on public.team_members;
create policy "Members can view team membership"
  on public.team_members for select using (
    user_id = auth.uid() or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can join teams" on public.team_members;
create policy "Users can join teams"
  on public.team_members for insert with check (auth.uid() = user_id);

drop policy if exists "Users can leave teams" on public.team_members;
create policy "Users can leave teams"
  on public.team_members for delete using (auth.uid() = user_id);

-- Coaches need to read their athletes' health snapshots for the team dashboard.
drop policy if exists "Coaches view athlete snapshots" on public.health_snapshots;
create policy "Coaches view athlete snapshots"
  on public.health_snapshots for select using (
    exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = health_snapshots.user_id and t.owner_id = auth.uid()
    )
  );

-- Coaches need athlete names/profiles for the roster.
drop policy if exists "Coaches view athlete profiles" on public.profiles;
create policy "Coaches view athlete profiles"
  on public.profiles for select using (
    exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = profiles.id and t.owner_id = auth.uid()
    )
  );
