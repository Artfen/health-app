import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date().toISOString().split('T')[0]!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const { data: snapshots } = await supabase
    .from('health_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', sevenDaysAgo)
    .lte('date', today)
    .order('date', { ascending: true });

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const todaySnapshot = snapshots?.find((s) => s.date === today) ?? null;

  return (
    <DashboardClient
      profile={profile}
      todaySnapshot={todaySnapshot}
      weekSnapshots={snapshots ?? []}
      userId={user.id}
    />
  );
}
