import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tokens } = await supabase.from('garmin_tokens').select('*').eq('user_id', user.id).single();
  if (!tokens) return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient('', '', storage);
    const activities = await client.getActivities(30);
    return NextResponse.json({ activities });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
