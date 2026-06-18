import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { estimateCalories } from '@/lib/training/calories';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const admin = createAdminClient();
  let query = admin.from('training_sessions').select('*').eq('user_id', user.id);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  const { data } = await query.order('date', { ascending: true });
  return NextResponse.json({ sessions: data ?? [] });
}

const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// distance comes from the client in km; stored as meters to match the schema.
const distanceMeters = (km: unknown): number | null => {
  const n = num(km);
  return n == null ? null : Math.round(n * 1000);
};

async function userWeight(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<number | null> {
  const { data } = await admin.from('profiles').select('weight_kg').eq('id', userId).single();
  return data?.weight_kg ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { date, title, type, description, duration_min, intensity, exercises, rpe, feel } = body;
  if (!date || !title?.trim()) {
    return NextResponse.json({ error: 'Date and title are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const durationMin = num(duration_min);

  // Calories: explicit value wins; otherwise estimate from weight + workout.
  const explicit = num(body.calories);
  let calories: number | null = explicit;
  let caloriesEstimated = false;
  if (explicit == null) {
    const estimate = estimateCalories({
      type, intensity, durationMin, weightKg: await userWeight(admin, user.id),
    });
    if (estimate != null) { calories = estimate; caloriesEstimated = true; }
  }

  const { data, error } = await admin
    .from('training_sessions')
    .insert({
      user_id: user.id,
      date,
      title: title.trim(),
      type: type ?? null,
      description: description ?? null,
      duration_min: durationMin,
      intensity: intensity ?? null,
      exercises: Array.isArray(exercises) ? exercises : [],
      rpe: num(rpe),
      distance_meters: distanceMeters(body.distance_km),
      start_time: body.start_time || null,
      feel: feel ?? null,
      calories,
      calories_estimated: caloriesEstimated,
      created_by: 'user',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ session: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...fields } = await request.json();
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  const direct = ['date', 'title', 'type', 'description', 'duration_min', 'intensity', 'status', 'exercises', 'feel'];
  for (const k of direct) if (k in fields) update[k] = fields[k];
  if ('rpe' in fields) update.rpe = num(fields.rpe);
  if ('start_time' in fields) update.start_time = fields.start_time || null;
  if ('distance_km' in fields) update.distance_meters = distanceMeters(fields.distance_km);

  // An explicit calories value the user typed always wins and is not an estimate.
  const explicitCalories = 'calories' in fields ? num(fields.calories) : undefined;
  if (explicitCalories != null) {
    update.calories = explicitCalories;
    update.calories_estimated = false;
  } else {
    // Re-estimate when the user cleared the override, or changed an input that
    // drives the estimate (type/intensity/duration) — but never overwrite a
    // value the user entered manually.
    const clearedOverride = 'calories' in fields; // present but null/empty
    const touchesInputs = 'type' in fields || 'intensity' in fields || 'duration_min' in fields;
    if (clearedOverride || touchesInputs) {
      const { data: existing } = await admin
        .from('training_sessions')
        .select('type, intensity, duration_min, calories, calories_estimated')
        .eq('id', id).eq('user_id', user.id).single();
      const isManualOverride = existing != null && existing.calories != null && existing.calories_estimated === false;
      if (clearedOverride || !isManualOverride) {
        const estimate = estimateCalories({
          type: 'type' in fields ? fields.type : existing?.type,
          intensity: 'intensity' in fields ? fields.intensity : existing?.intensity,
          durationMin: num('duration_min' in fields ? fields.duration_min : existing?.duration_min),
          weightKg: await userWeight(admin, user.id),
        });
        update.calories = estimate;
        update.calories_estimated = estimate != null;
      }
    }
  }

  const { data, error } = await admin
    .from('training_sessions')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ session: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const admin = createAdminClient();
  await admin.from('training_sessions').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
