import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Returns (and lazily creates) the signed-in user's Apple Health ingest token
// and the personal URL their Shortcut should POST to. POST with
// { regenerate: true } to rotate the token (invalidates the old link).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { regenerate } = await request.json().catch(() => ({ regenerate: false }));

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('apple_health_token')
    .eq('id', user.id)
    .single();

  let token = profile?.apple_health_token ?? null;
  if (!token || regenerate) {
    token = randomBytes(24).toString('hex');
    const { error } = await admin.from('profiles').update({ apple_health_token: token }).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    token,
    ingestUrl: `${origin}/api/apple-health/ingest`,
    url: `${origin}/api/apple-health/ingest?token=${token}`,
  });
}
