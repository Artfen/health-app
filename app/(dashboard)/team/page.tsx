import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import TeamClient, { type RosterTeam, type AthleteTeam, type RosterMember } from '@/components/dashboard/TeamClient';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  // Teams this user coaches (owns)
  const { data: ownedTeams } = await admin
    .from('teams')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  const rosters: RosterTeam[] = [];

  if (ownedTeams && ownedTeams.length > 0) {
    const teamIds = ownedTeams.map((t) => t.id);
    const { data: memberships } = await admin
      .from('team_members')
      .select('team_id, user_id, role, joined_at')
      .in('team_id', teamIds);

    const allMemberIds = [...new Set((memberships ?? []).map((m) => m.user_id))];

    const [{ data: profiles }, { data: snaps }] = await Promise.all([
      allMemberIds.length
        ? admin.from('profiles').select('id, full_name, email, garmin_display_name, garmin_connected').in('id', allMemberIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      allMemberIds.length
        ? admin.from('health_snapshots').select('user_id, date, steps, sleep_seconds, hrv_last_night, body_battery_high, resting_hr, active_seconds').in('user_id', allMemberIds).gte('date', past7).order('date', { ascending: true })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    const snapsByUser = new Map<string, Record<string, unknown>[]>();
    for (const s of (snaps ?? [])) {
      const arr = snapsByUser.get(s.user_id as string) ?? [];
      arr.push(s);
      snapsByUser.set(s.user_id as string, arr);
    }

    for (const team of ownedTeams) {
      const teamMembers = (memberships ?? [])
        .filter((m) => m.team_id === team.id && m.role !== 'coach')
        .map((m) => {
          const p = profileById.get(m.user_id);
          return {
            id: m.user_id,
            name: (p?.full_name as string) ?? (p?.email as string)?.split('@')[0] ?? 'Athlete',
            email: (p?.email as string) ?? '',
            garminConnected: Boolean(p?.garmin_connected),
            snapshots: (snapsByUser.get(m.user_id) ?? []) as unknown as RosterMember['snapshots'],
          };
        });
      rosters.push({ id: team.id, name: team.name, joinCode: team.join_code, members: teamMembers });
    }
  }

  // Teams this user belongs to as an athlete
  const { data: athleteRows } = await admin
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .neq('role', 'coach');

  const athleteTeams: AthleteTeam[] = [];
  if (athleteRows && athleteRows.length) {
    const ids = athleteRows.map((r) => r.team_id);
    const { data: teams } = await admin.from('teams').select('id, name, owner_id').in('id', ids);
    const ownerIds = [...new Set((teams ?? []).map((t) => t.owner_id))];
    const { data: owners } = ownerIds.length
      ? await admin.from('profiles').select('id, full_name, email').in('id', ownerIds)
      : { data: [] as Record<string, unknown>[] };
    const ownerById = new Map((owners ?? []).map((o) => [o.id as string, o]));
    for (const t of (teams ?? [])) {
      const o = ownerById.get(t.owner_id);
      athleteTeams.push({
        id: t.id,
        name: t.name,
        coachName: (o?.full_name as string) ?? (o?.email as string)?.split('@')[0] ?? 'Your coach',
      });
    }
  }

  return <TeamClient rosters={rosters} athleteTeams={athleteTeams} />;
}
