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

  const { garminEmail, garminPassword } = await request.json();

  if (!garminEmail || !garminPassword) {
    return NextResponse.json({ error: 'Garmin email and password are required' }, { status: 400 });
  }

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient(garminEmail, garminPassword, storage);

    // Trigger auth by fetching today's summary
    const today = new Date().toISOString().split('T')[0]!;
    await client.getDailySummary(today);

    const tokens = client.tokens;

    // Update profile to mark Garmin as connected
    await supabase.from('profiles').update({
      garmin_connected: true,
      garmin_display_name: tokens.profile?.displayName ?? null,
    }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      displayName: tokens.profile?.displayName,
    });
  } catch (error: unknown) {
    let message = error instanceof Error ? error.message : 'Failed to connect Garmin';
    if (message.includes('429') || message.includes('status code 429')) {
      message = 'Garmin is rate-limiting requests. Please wait 30-60 minutes and try again.';
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      message = 'Invalid Garmin credentials. Please check your email and password.';
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
