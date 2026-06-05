import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin.from('objectives').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json({ objectives: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, target_date } = await request.json();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('objectives').insert({
    user_id: user.id,
    title,
    description: description ?? null,
    target_date: target_date ?? null,
    status: 'active',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ objective: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, status } = await request.json();
  const admin = createAdminClient();
  await admin.from('objectives').update({ status }).eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const admin = createAdminClient();
  await admin.from('objectives').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
