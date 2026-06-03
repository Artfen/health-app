import { createClient } from '@/lib/supabase/server';
import ActivitiesClient from '@/components/dashboard/ActivitiesClient';

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return <ActivitiesClient profile={profile} />;
}
