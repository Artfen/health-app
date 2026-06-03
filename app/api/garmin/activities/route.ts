import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminClient } from '@/lib/garmin/garmin-client';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: tokens } = await admin.from('garmin_tokens').select('*').eq('user_id', user.id).single();
  if (!tokens) return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === 'true';

  try {
    const storage = createSupabaseTokenStorage(user.id);
    const client = new GarminClient('', '', storage);

    if (all) {
      // Paginate through all activities (100 per page)
      const allActivities = [];
      let start = 0;
      const pageSize = 100;

      while (true) {
        const page = await client.getActivities(pageSize, start);
        if (!page || page.length === 0) break;
        allActivities.push(...page);
        if (page.length < pageSize) break;
        start += pageSize;
        await new Promise(r => setTimeout(r, 300));
      }

      return NextResponse.json({ activities: allActivities, total: allActivities.length });
    } else {
      const activities = await client.getActivities(100, 0);
      return NextResponse.json({ activities });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
