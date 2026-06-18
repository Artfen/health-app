import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isLocale } from '@/lib/i18n/config';

// Update the signed-in user's profile settings: language, body metrics, name.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if ('locale' in body) {
    if (!isLocale(body.locale)) return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    update.locale = body.locale;
  }
  if ('full_name' in body) {
    update.full_name = typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : null;
  }

  const num = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  if ('weight_kg' in body) update.weight_kg = num(body.weight_kg);
  if ('height_cm' in body) update.height_cm = num(body.height_cm);
  if ('birth_year' in body) update.birth_year = num(body.birth_year);
  if ('sex' in body) {
    update.sex = body.sex === 'male' || body.sex === 'female' ? body.sex : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ profile: data });
}
