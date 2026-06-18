import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';
import { GarminClient } from '@/lib/garmin/garmin-client';
import CoachClient from '@/components/dashboard/CoachClient';

export const dynamic = 'force-dynamic';

async function syncTodayForUser(userId: string) {
  try {
    const storage = createSupabaseTokenStorage(userId);
    const tokens = await storage.load();
    if (!tokens) return;
    const garmin = new GarminClient('', '', storage);
    const today = new Date().toISOString().split('T')[0]!;
    const [summary, bb] = await Promise.all([
      garmin.getDailySummary(today),
      garmin.getBodyBatteryDay(today),
    ]);
    if (!summary) return;
    const admin = createAdminClient();
    await admin.from('health_snapshots').upsert({
      user_id: userId,
      date: today,
      source: 'garmin',
      steps: summary.totalSteps ?? null,
      calories: summary.activeKilocalories ?? null,
      resting_hr: summary.restingHeartRateValue ?? null,
      avg_stress: summary.averageStressLevel ?? null,
      body_battery_high: bb.high ?? summary.bodyBatteryHighestValue ?? null,
      body_battery_low: bb.low ?? summary.bodyBatteryLowestValue ?? null,
      distance_meters: summary.totalDistanceMeters ?? null,
      active_seconds: summary.activeSeconds ?? null,
    }, { onConflict: 'user_id,date' });
  } catch {
    // silent — don't block page load if sync fails
  }
}

export default async function CoachPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Silently sync today's data before loading the coach
  await syncTodayForUser(user.id);

  const admin = createAdminClient();
  const today = new Date().toISOString().split('T')[0]!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const [{ data: snapshots }, { data: objectives }] = await Promise.all([
    admin.from('health_snapshots').select('*').eq('user_id', user.id)
      .gte('date', sevenDaysAgo).lte('date', today).order('date', { ascending: false }),
    admin.from('objectives').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  return (
    <CoachClient
      snapshots={snapshots ?? []}
      objectives={objectives ?? []}
    />
  );
}
