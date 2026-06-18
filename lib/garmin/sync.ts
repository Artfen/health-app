import { GarminClient } from './garmin-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

// Fetch one day's metrics from Garmin and shape them into a health_snapshots row.
export async function syncDate(client: GarminClient, userId: string, syncDate: string) {
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

// The last `days` calendar dates (UTC), oldest → newest.
export function lastNDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
  );
}

// Sync a range of days for one user, upserting each day as it's fetched so
// partial progress survives a timeout. Used by the manual sync and the cron.
export async function syncGarminRange(userId: string, days: number) {
  const admin = createAdminClient();
  const client = new GarminClient('', '', createSupabaseTokenStorage(userId));
  const today = new Date().toISOString().split('T')[0]!;

  let synced = 0;
  let todaySnapshot: Awaited<ReturnType<typeof syncDate>> | null = null;
  for (const d of lastNDates(days)) {
    try {
      const snapshot = await syncDate(client, userId, d);
      const { error } = await admin.from('health_snapshots').upsert(snapshot, { onConflict: 'user_id,date' });
      if (error) throw new Error(`DB write failed: ${error.message}`);
      synced++;
      if (d === today) todaySnapshot = snapshot;
      await new Promise((r) => setTimeout(r, 200)); // gentle on Garmin's rate limit
    } catch {
      // skip a day that fails rather than failing the whole sync
    }
  }
  return { synced, todaySnapshot, today };
}
