import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get stored Garmin credentials
  const { data: tokens } = await supabase
    .from('garmin_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!tokens) {
    return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });
  }

  const { date } = await request.json().catch(() => ({}));
  const syncDate = date ?? new Date().toISOString().split('T')[0];

  try {
    // We use a dummy email/password since tokens are already stored
    const storage = createSupabaseTokenStorage(user.id);

    // Load directly from stored tokens (no re-login needed)
    const client = new GarminClient('', '', storage);

    const [summary, sleep, hrv] = await Promise.allSettled([
      client.getDailySummary(syncDate),
      client.getSleepData(syncDate),
      client.getHRV(syncDate),
    ]);

    const summaryData = summary.status === 'fulfilled' ? summary.value : null;
    const sleepData = sleep.status === 'fulfilled' ? sleep.value : null;
    const hrvData = hrv.status === 'fulfilled' ? hrv.value : null;

    const snapshot = {
      user_id: user.id,
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

    await supabase.from('health_snapshots').upsert(snapshot, {
      onConflict: 'user_id,date',
    });

    return NextResponse.json({ success: true, date: syncDate, snapshot });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
