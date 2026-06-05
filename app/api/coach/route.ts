import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmtSleep(seconds: number | null) {
  if (!seconds) return 'no data';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function buildHealthContext(snapshots: Array<Record<string, unknown>>, objective: { title: string; description?: string | null; target_date?: string | null } | null) {
  const recent = snapshots.slice(-7);
  const today = recent[recent.length - 1];

  // Current time context
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? 'early morning (before 6am)' : hour < 12 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Body battery context: current value estimated by how much has drained since peak
  const batteryPeak = today?.body_battery_high as number | null ?? null;
  const batteryLow = today?.body_battery_low as number | null ?? null;
  const batteryDrained = batteryPeak && batteryLow ? batteryPeak - batteryLow : null;
  const currentBatteryEstimate = batteryPeak && batteryDrained
    ? `~${Math.max(batteryLow ?? 0, batteryPeak - Math.round(batteryDrained * Math.min(hour / 16, 1)))} (estimated current, peak was ${batteryPeak})`
    : batteryPeak ? `${batteryPeak} (peak today)` : 'no data';

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
  const healthContext = buildHealthContext((snapshots ?? []) as Array<Record<string, unknown>>, activeObjective);

  const systemPrompt = `You are an expert personal health and fitness coach with deep knowledge of endurance sports, strength training, recovery science, and wearable data interpretation.

${healthContext}

## Your Role
Analyze the athlete's data and provide specific, actionable coaching advice. Be direct and precise - like a real coach, not a chatbot.

Key principles:
- Always reference the actual numbers from their data
- Identify patterns (e.g. poor sleep before hard training days, HRV trends)
- Flag recovery issues before they become injuries
- Give specific workout recommendations based on their current load and objective
- Keep responses concise but impactful - max 3-4 paragraphs unless asked for detail
- Never give generic advice - always tie it back to their specific metrics

If they have an objective, every recommendation should move them toward it.`;

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
          controller.enqueue(encoder.encode(event.delta.text));
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
