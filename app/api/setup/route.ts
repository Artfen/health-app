import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use Supabase's SQL endpoint directly with service role
  const sql = `
    create table if not exists public.objectives (
      id uuid default uuid_generate_v4() primary key,
      user_id uuid references auth.users on delete cascade not null,
      title text not null,
      description text,
      target_date date,
      status text default 'active' check (status in ('active', 'completed', 'paused')),
      created_at timestamptz default now()
    );

    alter table public.objectives enable row level security;

    do $$ begin
      if not exists (
        select 1 from pg_policies
        where tablename = 'objectives'
        and policyname = 'Users can manage their own objectives'
      ) then
        create policy "Users can manage their own objectives"
          on public.objectives for all using (auth.uid() = user_id);
      end if;
    end $$;
  `;

  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
    body: JSON.stringify({ query: sql }),
  });

  // The above won't work — Supabase REST doesn't expose raw SQL.
  // Use the Postgres connection via the management API instead.
  // The correct approach: Supabase exposes /pg at the db URL.

  // Simplest working approach: use fetch to Supabase's SQL via pg proxy
  const pgRes = await fetch(`${supabaseUrl}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!pgRes.ok) {
    // Last resort: check if table already exists by querying it
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { error } = await admin.from('objectives').select('id').limit(1);
    if (!error) {
      return NextResponse.json({ ok: true, message: 'Table already exists - no migration needed' });
    }
    return NextResponse.json({
      ok: false,
      message: 'Cannot run SQL automatically. Please run supabase/migration_objectives.sql in the Supabase SQL editor.',
      sql: sql.trim(),
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Migration complete' });
}
