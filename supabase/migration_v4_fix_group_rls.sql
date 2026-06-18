-- ============================================================
-- Fix: "infinite recursion detected in policy for relation group_members"
--
-- Same class of bug as the teams fix, but in the original groups schema:
--   - groups SELECT policy queried group_members
--   - group_members SELECT policy queried group_members (itself!)
--   - profiles / health_snapshots "group members can view each other" policies
--     queried group_members too
-- so reading a group row re-entered these policies endlessly.
--
-- Fix: move the membership checks into SECURITY DEFINER helpers that bypass RLS
-- on the read. Safe to run once.
-- ============================================================

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = uid);
$$;

-- True when users a and b share at least one group.
create or replace function public.shares_group(a uuid, b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = a and gm2.user_id = b
  );
$$;

drop policy if exists "Group members can view their groups" on public.groups;
create policy "Group members can view their groups"
  on public.groups for select using (
    auth.uid() = owner_id or public.is_group_member(id, auth.uid())
  );

drop policy if exists "Users can view memberships in their groups" on public.group_members;
create policy "Users can view memberships in their groups"
  on public.group_members for select using (
    user_id = auth.uid() or public.is_group_member(group_id, auth.uid())
  );

drop policy if exists "Group members can view each other's profiles" on public.profiles;
create policy "Group members can view each other's profiles"
  on public.profiles for select using (public.shares_group(auth.uid(), id));

drop policy if exists "Group members can view each other's snapshots" on public.health_snapshots;
create policy "Group members can view each other's snapshots"
  on public.health_snapshots for select using (public.shares_group(auth.uid(), user_id));
