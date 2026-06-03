import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  verifyWebhookSignature,
  normalizeDailyData,
  normalizeSleepData,
  type TerraDailyPayload,
  type TerraSleepPayload,
} from '@/lib/terra/terra-client';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('terra-signature') ?? '';

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const type: string = payload.type;
  const terraUserId: string = payload.user?.user_id;

  if (!terraUserId) return NextResponse.json({ ok: true });

  const supabase = await createClient();

  // On user_auth event: store terra_user_id on the profile
  if (type === 'user_auth') {
    const referenceId: string = payload.user?.reference_id;
    if (referenceId) {
      await supabase.from('profiles').update({
        terra_user_id: terraUserId,
        terra_provider: payload.user?.provider ?? null,
        terra_connected: true,
      }).eq('id', referenceId);
    }
    return NextResponse.json({ ok: true });
  }

  // For data events, find the user by terra_user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('terra_user_id', terraUserId)
    .single();

  if (!profile) return NextResponse.json({ ok: true });

  const userId = profile.id;

  if (type === 'daily') {
    const daily = payload as TerraDailyPayload;
    for (const item of daily.data ?? []) {
      const date = item.metadata.start_time.split('T')[0];
      if (!date) continue;
      const normalized = normalizeDailyData(item);
      await supabase.from('health_snapshots').upsert(
        { user_id: userId, date, ...normalized, synced_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      );
    }
  }

  if (type === 'sleep') {
    const sleep = payload as TerraSleepPayload;
    for (const item of sleep.data ?? []) {
      const date = item.metadata.start_time.split('T')[0];
      if (!date) continue;
      const normalized = normalizeSleepData(item);
      await supabase.from('health_snapshots').upsert(
        { user_id: userId, date, ...normalized, synced_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
