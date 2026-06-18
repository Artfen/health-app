import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncGarminRange } from '@/lib/garmin/sync';

export const dynamic = 'force-dynamic';
// Hint to the platform that this can run longer than a normal request.
export const maxDuration = 300;

// Scheduled sync for ALL connected users. No user session — authorized by a
// shared secret in the `x-cron-secret` header or `?secret=`. Syncs the last few
// days per user (self-heals small gaps); writes are per-day so a timeout still
// makes progress and the next run finishes the rest.
//
// Terra users are not pulled here — Terra pushes data to /api/terra/webhook.
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret') ?? new URL(request.url).searchParams.get('secret');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin.from('garmin_tokens').select('user_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];

  let totalSynced = 0;
  const results: { user: string; synced?: number; error?: string }[] = [];
  for (const uid of userIds) {
    try {
      const { synced } = await syncGarminRange(uid, 3);
      totalSynced += synced;
      results.push({ user: uid, synced });
    } catch (e) {
      results.push({ user: uid, error: e instanceof Error ? e.message : 'sync failed' });
    }
  }

  return NextResponse.json({ ok: true, users: userIds.length, totalSynced, results, ranAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) { return handle(request); }
export async function GET(request: NextRequest) { return handle(request); }
