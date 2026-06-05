import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import SleepClient from '@/components/dashboard/SleepClient';

export const dynamic = 'force-dynamic';

export default async function SleepPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const admin = createAdminClient();

  const { data: snapshots } = await admin
    .from('health_snapshots')
    .select('date, sleep_seconds, deep_sleep_seconds, rem_sleep_seconds, sleep_score, hrv_last_night, hrv_status')
    .eq('user_id', user.id)
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: true });

  return <SleepClient snapshots={snapshots ?? []} />;
}
