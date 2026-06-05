import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import CoachClient from '@/components/dashboard/CoachClient';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const today = new Date().toISOString().split('T')[0]!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const [{ data: snapshots }, { data: objectives }] = await Promise.all([
    admin.from('health_snapshots').select('*').eq('user_id', user.id)
      .gte('date', sevenDaysAgo).lte('date', today).order('date', { ascending: false }),
    admin.from('objectives').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  return (
    <CoachClient
      snapshots={snapshots ?? []}
      objectives={objectives ?? []}
    />
  );
}
