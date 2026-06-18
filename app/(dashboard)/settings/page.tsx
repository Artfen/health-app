import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from '@/components/dashboard/SettingsClient';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, locale, weight_kg, height_cm, birth_year, sex')
    .eq('id', user.id)
    .single();

  return <SettingsClient profile={profile ?? {}} />;
}
