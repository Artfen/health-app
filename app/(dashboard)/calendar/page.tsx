import { createClient } from '@/lib/supabase/server';
import CalendarClient from '@/components/dashboard/CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let weightKg: number | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('weight_kg').eq('id', user.id).single();
    weightKg = data?.weight_kg ?? null;
  }
  return <CalendarClient weightKg={weightKg} />;
}
