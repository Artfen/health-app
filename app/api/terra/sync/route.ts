import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDailyData,
  getSleepData,
  normalizeDailyData,
  normalizeSleepData,
  type TerraDailyPayload,
  type TerraSleepPayload,
} from '@/lib/terra/terra-client';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('terra_user_id')
    .eq('id', user.id)
    .single();

  if (!profile?.terra_user_id) {
    return NextResponse.json({ error: 'Terra not connected' }, { status: 400 });
  }

  const terraUserId = profile.terra_user_id;
  const today = new Date().toISOString().split('T')[0]!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  try {
    const [dailyRes, sleepRes] = await Promise.all([
      getDailyData(terraUserId, sevenDaysAgo, today),
      getSleepData(terraUserId, sevenDaysAgo, today),
    ]);

    const dailyData = (dailyRes as TerraDailyPayload).data ?? [];
    const sleepData = (sleepRes as TerraSleepPayload).data ?? [];

    for (const item of dailyData) {
      const date = item.metadata.start_time.split('T')[0];
      if (!date) continue;
      await supabase.from('health_snapshots').upsert(
        { user_id: user.id, date, ...normalizeDailyData(item), synced_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      );
    }

    for (const item of sleepData) {
      const date = item.metadata.start_time.split('T')[0];
      if (!date) continue;
      await supabase.from('health_snapshots').upsert(
        { user_id: user.id, date, ...normalizeSleepData(item), synced_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      );
    }

    return NextResponse.json({ success: true, synced: dailyData.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
