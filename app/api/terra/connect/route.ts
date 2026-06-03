import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWidgetSession } from '@/lib/terra/terra-client';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const session = await generateWidgetSession(user.id);
    return NextResponse.json({ url: session.url, sessionId: session.session_id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate Terra session';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
