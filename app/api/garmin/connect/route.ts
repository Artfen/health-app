import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { garminEmail, garminPassword } = await request.json();

  if (!garminEmail || !garminPassword) {
    return NextResponse.json({ error: 'Garmin email and password are required' }, { status: 400 });
  }

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient(garminEmail, garminPassword, storage);

    // Auth only - fetch activities (light call that triggers full auth + profile)
    await client.getActivities(1, 0);

    const tokens = client.tokens;
    const displayName = tokens.profile?.displayName ?? garminEmail.split('@')[0];

    // Use admin client to bypass RLS for profile update
    const admin = createAdminClient();
    await admin.from('profiles').update({
      garmin_connected: true,
      garmin_display_name: displayName,
    }).eq('id', user.id);

    // Kick off a background sync (non-blocking)
    const today = new Date().toISOString().split('T')[0]!;
    client.getDailySummary(today).catch(() => {});

    return NextResponse.json({ success: true, displayName });
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error('[garmin/connect] error:', raw);

    let message = raw;
    if (raw.includes('429')) {
      message = 'Garmin is rate-limiting requests. Please wait 30-60 minutes and try again.';
    } else if (raw.includes('401') || raw.toLowerCase().includes('unauthorized')) {
      message = 'Invalid Garmin credentials. Please check your email and password.';
    } else if (raw.includes('CSRF') || raw.includes('ticket')) {
      message = 'Garmin login page changed or is temporarily unavailable. Try again in a few minutes.';
    }
    return NextResponse.json({ error: message, debug: raw }, { status: 400 });
  }
}
