import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 });

  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The owner is also a member, with the coach role.
  await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'coach' });

  return NextResponse.json({ team });
}
