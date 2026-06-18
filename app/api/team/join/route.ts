import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { joinCode } = await request.json();
  if (!joinCode?.trim()) return NextResponse.json({ error: 'Join code is required' }, { status: 400 });

  // Look up by code with the admin client: athletes can't SELECT a team they're
  // not yet a member of under RLS, so resolve the code server-side.
  const admin = createAdminClient();
  const { data: team } = await admin
    .from('teams')
    .select('*')
    .eq('join_code', joinCode.trim().toUpperCase())
    .single();

  if (!team) return NextResponse.json({ error: 'Invalid join code' }, { status: 404 });

  const { data: existing } = await admin
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ team, alreadyMember: true });

  const { error } = await admin
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'athlete' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team });
}

// Leave a team (athlete) — coaches can't leave their own team here.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await request.json();
  const admin = createAdminClient();
  await admin.from('team_members').delete()
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .neq('role', 'coach');
  return NextResponse.json({ success: true });
}
