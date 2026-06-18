-- ============================================================
-- Fix: "new row violates row-level security policy for table groups"
--
-- The groups SELECT policy only let *members* view a group, but the create
-- flow inserts the group and reads it back BEFORE the owner's membership row
-- exists — so the owner couldn't see their own just-created group, and the
-- insert+return failed. Add an owner clause (mirrors the teams policy).
--
-- Safe to run once.
-- ============================================================

drop policy if exists "Group members can view their groups" on public.groups;
create policy "Group members can view their groups"
  on public.groups for select using (
    auth.uid() = owner_id or public.is_group_member(id, auth.uid())
  );
