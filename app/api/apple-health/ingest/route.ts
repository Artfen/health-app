import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Apple Watch / Apple Health ingest.
//
// Authenticated by a per-user token (NOT a Supabase session) because the
// request originates from the user's iPhone — sent by either:
//   1. An Apple Shortcut we publish (the simple flat format below), or
//   2. The Health Auto Export app (its nested { data: { metrics[] } } format).
//
// Token is read from `Authorization: Bearer <token>`, `?token=`, or body.token.
// Data is upserted into health_snapshots with source='apple_health'.

const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

type Snapshot = Record<string, number | string | null>;

// --- Format 1: the flat payload our published Shortcut sends ---------------
// { date, steps, calories, active_calories, resting_hr, hrv, vo2_max,
//   sleep_hours, sleep_minutes, distance_km, active_minutes }
function fromFlat(body: Record<string, unknown>): { date: string; snapshot: Snapshot } {
  const sleepH = num(body.sleep_hours);
  const sleepM = num(body.sleep_minutes);
  const sleepSeconds = sleepH != null || sleepM != null
    ? Math.round((sleepH ?? 0) * 3600 + (sleepM ?? 0) * 60)
    : null;
  const distanceKm = num(body.distance_km);
  const activeMin = num(body.active_minutes);

  return {
    date: typeof body.date === 'string' && body.date ? body.date.slice(0, 10) : todayISO(),
    snapshot: {
      steps: num(body.steps),
      calories: num(body.calories),
      active_calories: num(body.active_calories),
      resting_hr: num(body.resting_hr),
      hrv_last_night: num(body.hrv),
      vo2_max: num(body.vo2_max),
      sleep_seconds: sleepSeconds,
      distance_meters: distanceKm != null ? Math.round(distanceKm * 1000) : null,
      active_seconds: activeMin != null ? Math.round(activeMin * 60) : null,
    },
  };
}

// --- Format 2: Health Auto Export (best-effort) -----------------------------
// { data: { metrics: [{ name, units, data: [{ date, qty } | { date, Avg }] }] } }
const HAE_SUM = new Set(['step_count', 'active_energy', 'apple_exercise_time', 'walking_running_distance']);
function haeValue(metric: { name: string; data?: { qty?: number; Avg?: number; avg?: number }[] }): number | null {
  const points = metric.data ?? [];
  if (points.length === 0) return null;
  const vals = points.map((p) => p.qty ?? p.Avg ?? p.avg).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  if (HAE_SUM.has(metric.name)) return vals.reduce((a, b) => a + b, 0);
  // default: latest point
  return vals[vals.length - 1]!;
}
function fromHealthAutoExport(body: { data: { metrics: { name: string; units?: string; data?: { date?: string }[] }[] } }): { date: string; snapshot: Snapshot } {
  const metrics = body.data.metrics ?? [];
  const by = (name: string) => metrics.find((m) => m.name === name);
  const v = (name: string) => { const m = by(name); return m ? haeValue(m as never) : null; };

  // distance metric may be in km or mi
  const distM = by('walking_running_distance');
  const distVal = distM ? haeValue(distM as never) : null;
  const distMeters = distVal == null ? null
    : Math.round(distVal * ((distM?.units ?? '').toLowerCase().startsWith('mi') ? 1609.34 : 1000));

  const exerciseMin = v('apple_exercise_time'); // minutes
  const sleep = v('sleep_analysis'); // hours (HAE reports asleep duration in hr)

  // first available date stamp, else today
  const stamp = metrics.flatMap((m) => m.data ?? []).map((d) => d.date).find(Boolean);
  const date = stamp ? String(stamp).slice(0, 10) : todayISO();

  return {
    date,
    snapshot: {
      steps: v('step_count'),
      active_calories: v('active_energy'),
      resting_hr: v('resting_heart_rate'),
      hrv_last_night: v('heart_rate_variability'),
      vo2_max: v('vo2_max'),
      sleep_seconds: sleep != null ? Math.round(sleep * 3600) : null,
      distance_meters: distMeters,
      active_seconds: exerciseMin != null ? Math.round(exerciseMin * 60) : null,
    },
  };
}

function extractToken(request: NextRequest, body: Record<string, unknown>): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const q = new URL(request.url).searchParams.get('token');
  if (q) return q;
  if (typeof body.token === 'string') return body.token;
  return null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = extractToken(request, body);
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('apple_health_token', token)
    .single();
  if (!profile) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // Detect format and map.
  const isHAE = body.data && typeof body.data === 'object' && Array.isArray((body.data as { metrics?: unknown }).metrics);
  const { date, snapshot } = isHAE
    ? fromHealthAutoExport(body as never)
    : fromFlat(body);

  // Only write fields we actually received, so a partial sync (e.g. steps only)
  // merges into the day instead of nulling out other metrics.
  const clean = Object.fromEntries(Object.entries(snapshot).filter(([, v]) => v !== null));
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no recognizable metrics' });
  }

  const { error } = await admin.from('health_snapshots').upsert(
    { user_id: profile.id, date, source: 'apple_health', synced_at: new Date().toISOString(), ...clean },
    { onConflict: 'user_id,date' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, date });
}
