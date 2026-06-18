import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { inviteCode } = await request.json();
  if (!inviteCode?.trim()) return NextResponse.json({ error: 'Invite code required' }, { status: 400 });

  // Resolve the code with the admin client: under RLS a user can't SELECT a
  // group they don't yet belong to, so a user-scoped lookup would always fail.
  const admin = createAdminClient();
  const { data: group } = await admin
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  const { data: existing } = await admin
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ group, alreadyMember: true });
  }

  const { error } = await admin
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ group });
}
