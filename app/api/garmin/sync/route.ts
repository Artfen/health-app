import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

async function syncDate(client: GarminClient, userId: string, syncDate: string) {
  const [summary, sleep, hrv] = await Promise.allSettled([
    client.getDailySummary(syncDate),
    client.getSleepData(syncDate),
    client.getHRV(syncDate),
  ]);

  const summaryData = summary.status === 'fulfilled' ? summary.value : null;
  const sleepData = sleep.status === 'fulfilled' ? sleep.value : null;
  const hrvData = hrv.status === 'fulfilled' ? hrv.value : null;

  return {
    user_id: userId,
    date: syncDate,
    steps: summaryData?.totalSteps ?? null,
    calories: summaryData?.totalKilocalories ?? null,
    active_calories: summaryData?.activeKilocalories ?? null,
    resting_hr: summaryData?.restingHeartRateValue ?? null,
    avg_stress: summaryData?.averageStressLevel ?? null,
    body_battery_high: summaryData?.bodyBatteryHighestValue ?? null,
    body_battery_low: summaryData?.bodyBatteryLowestValue ?? null,
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

  const { date, backfill } = await request.json().catch(() => ({}));

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient('', '', storage);

    if (backfill) {
      // Sync last 30 days one by one
      const dates: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dates.push(d.toISOString().split('T')[0]!);
      }

      const snapshots = [];
      for (const d of dates) {
        try {
          const snapshot = await syncDate(client, user.id, d);
          snapshots.push(snapshot);
          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 300));
        } catch {
          // skip days that fail
        }
      }

      const { error } = await admin.from('health_snapshots').upsert(snapshots, { onConflict: 'user_id,date' });
      if (error) throw new Error(`DB write failed: ${error.message}`);

      return NextResponse.json({ success: true, synced: snapshots.length });
    } else {
      // Single day sync
      const syncDay = date ?? new Date().toISOString().split('T')[0];
      const snapshot = await syncDate(client, user.id, syncDay);

      const { error } = await admin.from('health_snapshots').upsert(snapshot, { onConflict: 'user_id,date' });
      if (error) throw new Error(`DB write failed: ${error.message}`);

      return NextResponse.json({ success: true, date: syncDay, snapshot });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    console.error('[garmin/sync] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
