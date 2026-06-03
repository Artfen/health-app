import { createClient } from '@/lib/supabase/server';
import GroupClient from '@/components/dashboard/GroupClient';

export default async function GroupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get user's groups
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id, groups(id, name, owner_id, invite_code)')
    .eq('user_id', user.id);

  const groups = memberships?.map((m) => m.groups).filter(Boolean).flat() ?? [];
  const primaryGroup = groups[0] ?? null;

  let members: Array<{ id: string; full_name: string | null; email: string; garmin_display_name: string | null }> = [];
  let memberSnapshots: Record<string, Array<{
    date: string;
    steps: number | null;
    sleep_seconds: number | null;
    hrv_last_night: number | null;
    body_battery_high: number | null;
    active_seconds: number | null;
    calories: number | null;
  }>> = {};

  if (primaryGroup) {
    // Get all members in this group
    const { data: groupMembers } = await supabase
      .from('group_members')
      .select('user_id, profiles(id, full_name, email, garmin_display_name)')
      .eq('group_id', primaryGroup.id);

    members = groupMembers?.map((gm) => gm.profiles).filter(Boolean).flat() as typeof members ?? [];

    // Get 7 days of snapshots for all members
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    const today = new Date().toISOString().split('T')[0]!;

    for (const member of members) {
      const { data: snaps } = await supabase
        .from('health_snapshots')
        .select('date, steps, sleep_seconds, hrv_last_night, body_battery_high, active_seconds, calories')
        .eq('user_id', member.id)
        .gte('date', sevenDaysAgo)
        .lte('date', today)
        .order('date', { ascending: true });

      memberSnapshots[member.id] = snaps ?? [];
    }
  }

  return (
    <GroupClient
      userId={user.id}
      primaryGroup={primaryGroup as { id: string; name: string; owner_id: string; invite_code: string } | null}
      members={members}
      memberSnapshots={memberSnapshots}
    />
  );
}
