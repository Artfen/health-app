import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import GroupClient, { type GroupData, type Member } from '@/components/dashboard/GroupClient';

export const dynamic = 'force-dynamic';

export default async function GroupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  // Every group the user belongs to.
  const { data: myMemberships } = await admin
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);
  const groupIds = [...new Set((myMemberships ?? []).map((m) => m.group_id))];

  const groups: GroupData[] = [];

  if (groupIds.length) {
    const [{ data: groupRows }, { data: allMemberships }] = await Promise.all([
      admin.from('groups').select('id, name, owner_id, invite_code').in('id', groupIds),
      admin.from('group_members').select('group_id, user_id').in('group_id', groupIds),
    ]);

    const allMemberIds = [...new Set((allMemberships ?? []).map((m) => m.user_id))];

    // Fetch profiles + snapshots by id (no FK exists from group_members to
    // profiles, so a nested embed returns nothing — fetch separately).
    const [{ data: profiles }, { data: snaps }] = await Promise.all([
      allMemberIds.length
        ? admin.from('profiles').select('id, full_name, email, garmin_display_name').in('id', allMemberIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      allMemberIds.length
        ? admin.from('health_snapshots').select('user_id, date, steps, sleep_seconds, hrv_last_night, body_battery_high, body_battery_current, active_seconds, calories, resting_hr, vo2_max').in('user_id', allMemberIds).gte('date', past7).order('date', { ascending: true })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    const snapsByUser = new Map<string, Record<string, unknown>[]>();
    for (const s of (snaps ?? [])) {
      const arr = snapsByUser.get(s.user_id as string) ?? [];
      arr.push(s);
      snapsByUser.set(s.user_id as string, arr);
    }

    for (const g of (groupRows ?? [])) {
      const memberIds = (allMemberships ?? []).filter((m) => m.group_id === g.id).map((m) => m.user_id);
      const members: Member[] = memberIds.map((id) => {
        const p = profileById.get(id);
        return {
          id,
          full_name: (p?.full_name as string) ?? null,
          email: (p?.email as string) ?? '',
          garmin_display_name: (p?.garmin_display_name as string) ?? null,
        };
      });
      const memberSnapshots: GroupData['memberSnapshots'] = {};
      for (const id of memberIds) {
        memberSnapshots[id] = (snapsByUser.get(id) ?? []) as unknown as GroupData['memberSnapshots'][string];
      }
      groups.push({ id: g.id, name: g.name, owner_id: g.owner_id, invite_code: g.invite_code, members, memberSnapshots });
    }

    // Keep a stable order: groups the user owns first, then by name.
    groups.sort((a, b) => {
      const ao = a.owner_id === user.id ? 0 : 1;
      const bo = b.owner_id === user.id ? 0 : 1;
      return ao - bo || a.name.localeCompare(b.name);
    });
  }

  return <GroupClient userId={user.id} groups={groups} />;
}
