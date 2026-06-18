import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Manual health logging for users without a wearable. Writes a snapshot for a
// given day, tagged source='manual'. Sleep is accepted in hours/minutes and
// stored as seconds to match the Garmin schema.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { date } = body;
  if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

  const num = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const sleepHours = num(body.sleep_hours);
  const sleepMinutes = num(body.sleep_minutes);
  const sleepSeconds =
    sleepHours != null || sleepMinutes != null
      ? Math.round((sleepHours ?? 0) * 3600 + (sleepMinutes ?? 0) * 60)
      : null;

  const snapshot = {
    user_id: user.id,
    date,
    source: 'manual',
    steps: num(body.steps),
    calories: num(body.calories),
    resting_hr: num(body.resting_hr),
    avg_stress: num(body.avg_stress),
    body_battery_high: num(body.body_battery_high),
    body_battery_low: num(body.body_battery_low),
    body_battery_current: num(body.body_battery_high),
    vo2_max: num(body.vo2_max),
    sleep_seconds: sleepSeconds,
    sleep_score: num(body.sleep_score),
    hrv_last_night: num(body.hrv_last_night),
    distance_meters: body.distance_km != null && body.distance_km !== ''
      ? Math.round(Number(body.distance_km) * 1000)
      : null,
    active_seconds: body.active_minutes != null && body.active_minutes !== ''
      ? Math.round(Number(body.active_minutes) * 60)
      : null,
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('health_snapshots')
    .upsert(snapshot, { onConflict: 'user_id,date' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, snapshot });
}
