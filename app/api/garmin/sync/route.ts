import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

async function syncDate(client: GarminClient, userId: string, syncDate: string) {
  const [summary, sleep, hrv, bb, vo2, rhr] = await Promise.allSettled([
    client.getDailySummary(syncDate),
    client.getSleepData(syncDate),
    client.getHRV(syncDate),
    client.getBodyBatteryDay(syncDate),
    client.getVo2Max(syncDate),
    client.getRestingHeartRateDay(syncDate),
  ]);

  const summaryData = summary.status === 'fulfilled' ? summary.value : null;
  const sleepData = sleep.status === 'fulfilled' ? sleep.value : null;
  const hrvData = hrv.status === 'fulfilled' ? hrv.value : null;
  const bbData = bb.status === 'fulfilled' ? bb.value : { high: null, low: null, current: null };
  const vo2Max = vo2.status === 'fulfilled' ? vo2.value : null;
  const rhrValue = rhr.status === 'fulfilled' ? rhr.value : null;

  // Resting HR field name in the summary is inconsistent; try both, then the
  // dedicated endpoint value.
  const summaryRhr = (summaryData as { restingHeartRateValue?: number; restingHeartRate?: number } | null);
  const restingHr = rhrValue ?? summaryRhr?.restingHeartRateValue ?? summaryRhr?.restingHeartRate ?? null;

  return {
    user_id: userId,
    date: syncDate,
    source: 'garmin',
    steps: summaryData?.totalSteps ?? null,
    calories: summaryData?.totalKilocalories ?? null,
    active_calories: summaryData?.activeKilocalories ?? null,
    resting_hr: restingHr,
    avg_stress: summaryData?.averageStressLevel ?? null,
    vo2_max: vo2Max,
    body_battery_high: bbData.high ?? summaryData?.bodyBatteryHighestValue ?? null,
    body_battery_low: bbData.low ?? summaryData?.bodyBatteryLowestValue ?? null,
    body_battery_current: bbData.current ?? null,
    sleep_seconds: sleepData?.dailySleepDTO?.deepSleepSeconds != null
      ? (sleepData.dailySleepDTO.deepSleepSeconds +
        sleepData.dailySleepDTO.lightSleepSeconds +
        sleepData.dailySleepDTO.remSleepSeconds)
      : null,
    deep_sleep_seconds: sleepData?.dailySleepDTO?.deepSleepSeconds ?? null,
    rem_sleep_seconds: sleepData?.dailySleepDTO?.remSleepSeconds ?? null,
    sleep_score: sleepData?.dailySleepDTO?.overallScore?.value ?? null,
    hrv_last_night: hrvData?.hrvSummary?.lastNight ?? null,
    hrv_status: hrvData?.hrvSummary?.status ?? null,
    distance_meters: summaryData?.totalDistanceMeters ?? null,
    active_seconds: summaryData?.activeSeconds ?? null,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from('garmin_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!tokens) return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });

  const { date, backfill, days } = await request.json().catch(() => ({}));

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient('', '', storage);

    if (date) {
      // Explicit single-day sync
      const snapshot = await syncDate(client, user.id, date);
      const { error } = await admin.from('health_snapshots').upsert(snapshot, { onConflict: 'user_id,date' });
      if (error) throw new Error(`DB write failed: ${error.message}`);
      return NextResponse.json({ success: true, date, snapshot, syncedAt: new Date().toISOString() });
    }

    // Range sync. Default "Sync now" pulls the last 7 days so the dashboard's
    // 7-day window fills in; re-syncing prior days also catches sleep/HRV that
    // Garmin publishes late. `backfill` does 30 days; `days` overrides (max 60).
    const rangeDays = backfill ? 30 : (typeof days === 'number' && days > 0 ? Math.min(days, 60) : 7);
    const today = new Date().toISOString().split('T')[0]!;

    // Oldest → newest so the upserts land in chronological order.
    const dates = Array.from({ length: rangeDays }, (_, i) =>
      new Date(Date.now() - (rangeDays - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
    );

    // Upsert each day as it's fetched so partial progress survives a timeout —
    // a long range can exceed the serverless limit, and repeated syncs then
    // fill in any days that didn't make it.
    let synced = 0;
    let todaySnapshot = null;
    for (const d of dates) {
      try {
        const snapshot = await syncDate(client, user.id, d);
        const { error } = await admin.from('health_snapshots').upsert(snapshot, { onConflict: 'user_id,date' });
        if (error) throw new Error(`DB write failed: ${error.message}`);
        synced++;
        if (d === today) todaySnapshot = snapshot;
        await new Promise((r) => setTimeout(r, 200)); // gentle on Garmin's rate limit
      } catch {
        // skip a day that fails rather than failing the whole sync
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      snapshot: todaySnapshot,
      synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    console.error('[garmin/sync] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
