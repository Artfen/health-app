import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('injuries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ injuries: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { body_part, description, severity, started_on } = await request.json();
  if (!body_part?.trim()) return NextResponse.json({ error: 'Body part is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('injuries')
    .insert({
      user_id: user.id,
      body_part: body_part.trim(),
      description: description ?? null,
      severity: severity ?? 'moderate',
      started_on: started_on || new Date().toISOString().split('T')[0],
      status: 'active',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ injury: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, status } = await request.json();
  const admin = createAdminClient();
  const update: Record<string, unknown> = { status };
  if (status === 'resolved') update.resolved_on = new Date().toISOString().split('T')[0];
  await admin.from('injuries').update(update).eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const admin = createAdminClient();
  await admin.from('injuries').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
