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

  const lines = [
    `## User Health Data (Last ${recent.length} days)`,
    '',
    today ? `### Today (${today.date})` : '',
    today?.steps ? `- Steps: ${(today.steps as number).toLocaleString()}` : '',
    today?.calories ? `- Calories burned: ${today.calories}` : '',
    today?.resting_hr ? `- Resting HR: ${today.resting_hr} bpm` : '',
    today?.hrv_last_night ? `- HRV last night: ${Math.round(today.hrv_last_night as number)} ms (${today.hrv_status ?? 'unknown status'})` : '',
    today?.body_battery_high ? `- Body Battery: peak ${today.body_battery_high}, low ${today.body_battery_low}` : '',
    today?.avg_stress ? `- Avg stress: ${today.avg_stress}/100` : '',
    today?.sleep_seconds ? `- Sleep: ${fmtSleep(today.sleep_seconds as number)} (deep: ${fmtSleep(today.deep_sleep_seconds as number)}, REM: ${fmtSleep(today.rem_sleep_seconds as number)})` : '',
    today?.distance_meters ? `- Distance: ${((today.distance_meters as number) / 1000).toFixed(1)} km` : '',
    today?.active_seconds ? `- Active time: ${Math.round((today.active_seconds as number) / 60)} min` : '',
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

  const [{ data: snapshots }, { data: objectives }] = await Promise.all([
    admin.from('health_snapshots').select('*').eq('user_id', user.id)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!)
      .order('date', { ascending: true }),
    admin.from('objectives').select('*').eq('user_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1),
  ]);

  const activeObjective = objectives?.[0] ?? null;
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
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
