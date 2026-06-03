import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { inviteCode } = await request.json();
  if (!inviteCode?.trim()) return NextResponse.json({ error: 'Invite code required' }, { status: 400 });

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ group, alreadyMember: true });
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ group });
}
