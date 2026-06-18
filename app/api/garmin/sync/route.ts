import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';
import { syncDate, syncGarminRange } from '@/lib/garmin/sync';

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
    if (date) {
      // Explicit single-day sync
      const client = new GarminClient('', '', createSupabaseTokenStorage(user.id));
      const snapshot = await syncDate(client, user.id, date);
      const { error } = await admin.from('health_snapshots').upsert(snapshot, { onConflict: 'user_id,date' });
      if (error) throw new Error(`DB write failed: ${error.message}`);
      return NextResponse.json({ success: true, date, snapshot, syncedAt: new Date().toISOString() });
    }

    // Range sync. Default "Sync now" pulls the last 7 days so the dashboard's
    // 7-day window fills in; `backfill` does 30 days; `days` overrides (max 60).
    const rangeDays = backfill ? 30 : (typeof days === 'number' && days > 0 ? Math.min(days, 60) : 7);
    const { synced, todaySnapshot, today } = await syncGarminRange(user.id, rangeDays);

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
