-- ============================================================
-- Fix: "infinite recursion detected in policy for relation teams"
--
-- The teams SELECT policy referenced team_members, and the team_members
-- SELECT policy referenced teams — so each policy triggered the other's
-- policy in an endless loop. The fix moves every cross-table membership/
-- ownership check into SECURITY DEFINER helper functions. Those run as the
-- function owner and bypass RLS on the tables they read, so the policies no
-- longer re-enter each other.
--
-- Safe to run once on top of the v2 migration.
-- ============================================================

create or replace function public.is_team_member(tid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.team_members where team_id = tid and user_id = uid);
$$;

create or replace function public.is_team_owner(tid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.teams where id = tid and owner_id = uid);
$$;

-- True when `coach` owns a team that `athlete` belongs to.
create or replace function public.is_coach_of(athlete uuid, coach uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = athlete and t.owner_id = coach
  );
$$;

-- ------------------------------------------------------------
-- Recreate the policies to use the helper functions
-- ------------------------------------------------------------

drop policy if exists "Team members can view their team" on public.teams;
create policy "Team members can view their team"
  on public.teams for select using (
    auth.uid() = owner_id or public.is_team_member(id, auth.uid())
  );

drop policy if exists "Members can view team membership" on public.team_members;
create policy "Members can view team membership"
  on public.team_members for select using (
    user_id = auth.uid() or public.is_team_owner(team_id, auth.uid())
  );

drop policy if exists "Coaches view athlete training" on public.training_sessions;
create policy "Coaches view athlete training"
  on public.training_sessions for select using (
    public.is_coach_of(user_id, auth.uid())
  );

drop policy if exists "Coaches view athlete snapshots" on public.health_snapshots;
create policy "Coaches view athlete snapshots"
  on public.health_snapshots for select using (
    public.is_coach_of(user_id, auth.uid())
  );

drop policy if exists "Coaches view athlete profiles" on public.profiles;
create policy "Coaches view athlete profiles"
  on public.profiles for select using (
    public.is_coach_of(id, auth.uid())
  );
