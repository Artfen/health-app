import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminClient } from '@/lib/garmin/garmin-client';
import type { GarminMfaState } from '@/lib/garmin/garmin-auth';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

// Shared success path: mark the profile connected and kick off a background sync.
async function finishConnection(userId: string, client: GarminClient, fallbackName: string) {
  const tokens = client.tokens;
  const displayName = tokens.profile?.displayName ?? fallbackName;

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ garmin_connected: true, garmin_display_name: displayName })
    .eq('id', userId);

  // Non-blocking warm-up sync for today.
  const today = new Date().toISOString().split('T')[0]!;
  client.getDailySummary(today).catch(() => {});

  return NextResponse.json({ success: true, displayName });
}

function humanizeError(raw: string): string {
  if (raw.startsWith('MFA_INVALID') || raw.startsWith('MFA_FAILED')) {
    return raw.replace(/^MFA_\w+:\s*/, '');
  }
  if (raw.includes('429')) {
    return 'Garmin is rate-limiting requests. Please wait 30-60 minutes and try again.';
  }
  if (raw.includes('401') || raw.toLowerCase().includes('unauthorized')) {
    return 'Invalid Garmin credentials. Please check your email and password.';
  }
  if (raw.includes('CSRF') || raw.includes('ticket')) {
    return 'Garmin login page changed or is temporarily unavailable. Try again in a few minutes.';
  }
  return raw;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { garminEmail, garminPassword, mfaCode } = body;
  const admin = createAdminClient();

  // ---- Phase 2: user is submitting the 2FA code ----
  if (mfaCode) {
    try {
      const { data: session } = await admin
        .from('garmin_mfa_sessions')
        .select('mfa_state')
        .eq('user_id', user.id)
        .single();

      if (!session?.mfa_state) {
        return NextResponse.json(
          { error: 'Your verification session expired. Please start again.', restart: true },
          { status: 400 },
        );
      }

      const storage = createSupabaseTokenStorage(user.id);
      // Email/password aren't needed to finish — the session state carries auth.
      const client = new GarminClient('', '', storage);
      await client.completeMfa(session.mfa_state as GarminMfaState, String(mfaCode));

      // One-time state, consume it.
      await admin.from('garmin_mfa_sessions').delete().eq('user_id', user.id);

      return await finishConnection(user.id, client, 'Athlete');
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error);
      console.error('[garmin/connect] mfa error:', raw);
      return NextResponse.json({ error: humanizeError(raw), debug: raw }, { status: 400 });
    }
  }

  // ---- Phase 1: credentials ----
  if (!garminEmail || !garminPassword) {
    return NextResponse.json({ error: 'Garmin email and password are required' }, { status: 400 });
  }

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient(garminEmail, garminPassword, storage);

    const result = await client.connect();

    if (result.mfaRequired) {
      // Persist the resumable session so the (stateless) phase-2 request can finish it.
      await admin.from('garmin_mfa_sessions').upsert({
        user_id: user.id,
        mfa_state: result.mfaState,
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ mfaRequired: true });
    }

    return await finishConnection(user.id, client, garminEmail.split('@')[0]);
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error('[garmin/connect] error:', raw);
    return NextResponse.json({ error: humanizeError(raw), debug: raw }, { status: 400 });
  }
}
