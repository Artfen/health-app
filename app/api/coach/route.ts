import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';
import { GarminClient } from '@/lib/garmin/garmin-client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmtSleep(seconds: number | null) {
  if (!seconds) return 'no data';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function buildActivitiesContext(activities: Array<Record<string, unknown>>) {
  if (!activities.length) return '';
  const lines = ['## Recent Activities (last 10)'];
  for (const a of activities) {
    const type = (a.activityType as { typeKey: string })?.typeKey ?? 'activity';
    const name = (a.activityName as string) ?? type;
    const date = a.startTimeLocal ? new Date(a.startTimeLocal as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    const time = a.startTimeLocal ? new Date(a.startTimeLocal as string).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
    const dist = a.distance ? `${((a.distance as number) / 1000).toFixed(1)} km` : null;
    const dur = a.duration ? `${Math.round((a.duration as number) / 60)} min` : null;
    const hr = a.averageHR ? `avg HR ${a.averageHR} bpm` : null;
    const cal = a.calories ? `${a.calories} kcal` : null;
    const aerobic = a.aerobicTrainingEffect ? `aerobic load ${a.aerobicTrainingEffect}` : null;
    const parts = [dist, dur, hr, cal, aerobic].filter(Boolean).join(', ');
    lines.push(`- ${date} ${time}: ${name} (${type}) — ${parts}`);
  }
  return lines.join('\n');
}

function buildHealthContext(snapshots: Array<Record<string, unknown>>, objective: { title: string; description?: string | null; target_date?: string | null } | null, activities: Array<Record<string, unknown>> = []) {
  const recent = snapshots.slice(-7);
  const today = recent[recent.length - 1];

  // Current time context
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? 'early morning (before 6am)' : hour < 12 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const batteryPeak = today?.body_battery_high as number | null ?? null;
  const batteryLow = today?.body_battery_low as number | null ?? null;
  const currentBatteryEstimate = batteryPeak
    ? `${batteryPeak} (today's peak), low so far: ${batteryLow ?? 'unknown'}`
    : 'no data';

  const lines = [
    `## Current Time Context`,
    `- Date: ${dateStr}`,
    `- Time: ${timeStr} (${timeOfDay})`,
    `- Day of week: ${dayName}`,
    `- This means: the user is asking this question ${timeOfDay}. Advice about training "today" should factor in what's already happened and what's still feasible at this time of day.`,
    '',
    `## User Health Data (Last ${recent.length} days)`,
    '',
    today ? `### Today (${today.date as string})` : '',
    today?.steps ? `- Steps so far today: ${(today.steps as number).toLocaleString()}` : '',
    today?.calories ? `- Calories burned so far: ${today.calories}` : '',
    today?.resting_hr ? `- Resting HR: ${today.resting_hr} bpm` : '',
    today?.hrv_last_night ? `- HRV last night: ${Math.round(today.hrv_last_night as number)} ms (${today.hrv_status ?? 'unknown status'})` : '',
    today?.body_battery_high ? `- Body Battery: ${currentBatteryEstimate}` : '',
    today?.avg_stress ? `- Avg stress so far today: ${today.avg_stress}/100` : '',
    today?.sleep_seconds ? `- Sleep last night: ${fmtSleep(today.sleep_seconds as number)} (deep: ${fmtSleep(today.deep_sleep_seconds as number)}, REM: ${fmtSleep(today.rem_sleep_seconds as number)})` : '',
    today?.distance_meters ? `- Distance covered today: ${((today.distance_meters as number) / 1000).toFixed(1)} km` : '',
    today?.active_seconds ? `- Active time today: ${Math.round((today.active_seconds as number) / 60)} min` : '',
    '',
    '### 7-day trends',
    `- Avg steps: ${Math.round(recent.filter(s => s.steps).reduce((a, s) => a + (s.steps as number), 0) / recent.filter(s => s.steps).length || 0).toLocaleString()}`,
    `- Avg sleep: ${fmtSleep(Math.round(recent.filter(s => s.sleep_seconds).reduce((a, s) => a + (s.sleep_seconds as number), 0) / recent.filter(s => s.sleep_seconds).length || 0))}`,
    `- Avg HRV: ${recent.filter(s => s.hrv_last_night).length > 0 ? Math.round(recent.filter(s => s.hrv_last_night).reduce((a, s) => a + (s.hrv_last_night as number), 0) / recent.filter(s => s.hrv_last_night).length) + ' ms' : 'no data'}`,
    `- Avg body battery peak: ${recent.filter(s => s.body_battery_high).length > 0 ? Math.round(recent.filter(s => s.body_battery_high).reduce((a, s) => a + (s.body_battery_high as number), 0) / recent.filter(s => s.body_battery_high).length) : 'no data'}`,
    '',
    objective ? `## Current Objective: ${objective.title}` : '## No active objective set',
    objective?.description ? `Description: ${objective.description}` : '',
    objective?.target_date ? `Target date: ${objective.target_date}` : '',
    '',
    buildActivitiesContext(activities),
  ].filter(l => l !== '');

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messages } = await request.json();

  const admin = createAdminClient();

  const { data: snapshots } = await admin.from('health_snapshots').select('*').eq('user_id', user.id)
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!)
    .order('date', { ascending: true });

  let activeObjective: { title: string; description?: string | null; target_date?: string | null } | null = null;
  try {
    const { data: objectives } = await admin.from('objectives').select('*').eq('user_id', user.id)
      .eq('status', 'active').order('created_at', { ascending: false }).limit(1);
    activeObjective = objectives?.[0] ?? null;
  } catch { /* objectives table may not exist yet */ }
  // Fetch recent activities from Garmin
  let recentActivities: Array<Record<string, unknown>> = [];
  try {
    const storage = createSupabaseTokenStorage(user.id);
    const tokens = await storage.load();
    if (tokens) {
      const garmin = new GarminClient('', '', storage);
      recentActivities = (await garmin.getActivities(10, 0)) as Array<Record<string, unknown>>;
    }
  } catch { /* skip if Garmin unavailable */ }

  const healthContext = buildHealthContext((snapshots ?? []) as Array<Record<string, unknown>>, activeObjective, recentActivities);

  const systemPrompt = `You are an expert personal health and fitness coach with deep knowledge of endurance sports, strength training, recovery science, and wearable data interpretation.

${healthContext}

## How you communicate
Talk like a real coach who actually knows this athlete. Not a chatbot, not a report generator. Short sentences. Direct. Honest. Warm but no fluff.

Never use em-dashes (— or --). Never use bullet points unless the athlete asks for a structured plan. Write in flowing sentences like you're talking to someone face to face.

Don't open with "Great question!" or "Certainly!" or any filler. Just answer.

Reference their actual numbers naturally in conversation ("your HRV was 62 last night, that's solid" not "HRV: 62ms").

When suggesting workouts, offer 2-3 concrete options across different types so they can pick what suits them. For example if they ask what to train, give them a running option, a strength option, and a recovery option - with specific details (duration, intensity, HR zones, sets/reps where relevant).

Keep replies conversational length - like a voice note from a coach, not a training document. Unless they ask for a full plan, in which case go detailed.

If they have an objective, every suggestion should move them toward it. Point that out when relevant.

NEVER use the em-dash character (— or –) anywhere in your response. Use a comma or a new sentence instead.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
        stream: true,
      });

      for await (const event of response) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const clean = event.delta.text.replace(/—|–/g, ',');
          controller.enqueue(encoder.encode(clean));
        }
      }
      controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error from AI';
        controller.enqueue(encoder.encode(`Sorry, I ran into an error: ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
