import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ActivitiesClient from '@/components/dashboard/ActivitiesClient';

export const dynamic = 'force-dynamic';

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single();

  return <ActivitiesClient profile={profile} />;
}
