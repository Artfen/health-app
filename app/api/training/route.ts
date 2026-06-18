import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const admin = createAdminClient();
  let query = admin.from('training_sessions').select('*').eq('user_id', user.id);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  const { data } = await query.order('date', { ascending: true });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, title, type, description, duration_min, intensity } = await request.json();
  if (!date || !title?.trim()) {
    return NextResponse.json({ error: 'Date and title are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('training_sessions')
    .insert({
      user_id: user.id,
      date,
      title: title.trim(),
      type: type ?? null,
      description: description ?? null,
      duration_min: duration_min ?? null,
      intensity: intensity ?? null,
      created_by: 'user',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ session: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...fields } = await request.json();
  const allowed = ['date', 'title', 'type', 'description', 'duration_min', 'intensity', 'status'];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in fields) update[k] = fields[k];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('training_sessions')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ session: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const admin = createAdminClient();
  await admin.from('training_sessions').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
