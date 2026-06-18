import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseTokenStorage } from '@/lib/supabase/token-storage';
import { GarminClient } from '@/lib/garmin/garmin-client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5';

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
    const dist = a.distance ? `${((a.distance as number) / 1000).toFixed(1)} km` : null;
    const dur = a.duration ? `${Math.round((a.duration as number) / 60)} min` : null;
    const hr = a.averageHR ? `avg HR ${a.averageHR} bpm` : null;
    const cal = a.calories ? `${a.calories} kcal` : null;
    const aerobic = a.aerobicTrainingEffect ? `aerobic load ${a.aerobicTrainingEffect}` : null;
    const parts = [dist, dur, hr, cal, aerobic].filter(Boolean).join(', ');
    lines.push(`- ${date}: ${name} (${type}) — ${parts}`);
  }
  return lines.join('\n');
}

type Injury = { id: string; body_part: string; description: string | null; severity: string; status: string; started_on: string | null };
type TrainingSession = { id: string; date: string; title: string; type: string | null; description: string | null; duration_min: number | null; intensity: string | null; status: string; created_by: string };

function buildInjuryContext(injuries: Injury[]) {
  const active = injuries.filter((i) => i.status === 'active');
  if (!active.length) return '## Injuries\nNo active injuries reported.';
  const lines = ['## Active Injuries (factor these into EVERY recommendation)'];
  for (const i of active) {
    const since = i.started_on ? ` since ${i.started_on}` : '';
    lines.push(`- [id: ${i.id}] ${i.body_part} (${i.severity})${since}${i.description ? `: ${i.description}` : ''}`);
  }
  lines.push('Do not suggest training that loads an injured area. Offer alternatives that work around it.');
  return lines.join('\n');
}

function buildScheduleContext(sessions: TrainingSession[]) {
  if (!sessions.length) return '## Training Calendar\nNo sessions scheduled. You can add some with the calendar tools.';
  const lines = ['## Training Calendar (upcoming + recent)'];
  for (const s of sessions) {
    const bits = [s.type, s.duration_min ? `${s.duration_min} min` : null, s.intensity].filter(Boolean).join(', ');
    lines.push(`- [id: ${s.id}] ${s.date}: ${s.title}${bits ? ` (${bits})` : ''} — ${s.status}`);
  }
  return lines.join('\n');
}

function buildHealthContext(
  snapshots: Array<Record<string, unknown>>,
  objective: { title: string; description?: string | null; target_date?: string | null } | null,
  activities: Array<Record<string, unknown>>,
  injuries: Injury[],
  sessions: TrainingSession[],
) {
  const recent = snapshots.slice(-7);
  const today = recent[recent.length - 1];

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? 'early morning (before 6am)' : hour < 12 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const todayISO = now.toISOString().split('T')[0];

  const lines = [
    `## Current Time Context`,
    `- Today is ${dateStr} (${todayISO})`,
    `- Time: ${timeStr} (${timeOfDay}), ${dayName}`,
    `- Use ${todayISO} as "today" when scheduling. Dates must be YYYY-MM-DD.`,
    '',
    `## Health Data (last ${recent.length} days)`,
    today ? `### Today (${today.date as string})` : '',
    today?.steps ? `- Steps so far: ${(today.steps as number).toLocaleString()}` : '',
    today?.resting_hr ? `- Resting HR: ${today.resting_hr} bpm` : '',
    today?.hrv_last_night ? `- HRV last night: ${Math.round(today.hrv_last_night as number)} ms (${today.hrv_status ?? 'unknown'})` : '',
    today?.body_battery_high ? `- Body Battery peak: ${today.body_battery_high}, low: ${today.body_battery_low ?? 'unknown'}` : '',
    today?.avg_stress ? `- Avg stress: ${today.avg_stress}/100` : '',
    today?.sleep_seconds ? `- Sleep last night: ${fmtSleep(today.sleep_seconds as number)}` : '',
    '',
    '### 7-day averages',
    `- Steps: ${Math.round(recent.filter(s => s.steps).reduce((a, s) => a + (s.steps as number), 0) / (recent.filter(s => s.steps).length || 1)).toLocaleString()}`,
    `- Sleep: ${fmtSleep(Math.round(recent.filter(s => s.sleep_seconds).reduce((a, s) => a + (s.sleep_seconds as number), 0) / (recent.filter(s => s.sleep_seconds).length || 1)))}`,
    `- HRV: ${recent.filter(s => s.hrv_last_night).length > 0 ? Math.round(recent.filter(s => s.hrv_last_night).reduce((a, s) => a + (s.hrv_last_night as number), 0) / recent.filter(s => s.hrv_last_night).length) + ' ms' : 'no data'}`,
    '',
    objective ? `## Current Objective: ${objective.title}${objective.description ? ` — ${objective.description}` : ''}${objective.target_date ? ` (target ${objective.target_date})` : ''}` : '## No active objective set',
    '',
    buildInjuryContext(injuries),
    '',
    buildScheduleContext(sessions),
    '',
    buildActivitiesContext(activities),
  ].filter((l) => l !== '');

  return lines.join('\n');
}

// ---- Tools the coach can use to manage the athlete's plan ----
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_training_session',
    description: 'Add a planned training session to the athlete\'s calendar. Call this when the athlete asks you to plan a workout, build a week, or schedule something. Create one call per session — call it multiple times to build out a multi-day plan.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Session date, YYYY-MM-DD' },
        title: { type: 'string', description: 'Short title, e.g. "Easy 5k run" or "Upper body strength"' },
        type: { type: 'string', enum: ['run', 'strength', 'recovery', 'mobility', 'cardio', 'rest', 'other'], description: 'Session category' },
        duration_min: { type: 'integer', description: 'Planned duration in minutes' },
        intensity: { type: 'string', enum: ['easy', 'moderate', 'hard'], description: 'Effort level' },
        description: { type: 'string', description: 'Specifics: intervals, HR zones, sets/reps, pace targets' },
      },
      required: ['date', 'title'],
    },
  },
  {
    name: 'update_training_session',
    description: 'Modify an existing planned session. Use the [id: ...] shown in the Training Calendar context. Only pass the fields you want to change.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The session id from the calendar context' },
        date: { type: 'string', description: 'New date, YYYY-MM-DD' },
        title: { type: 'string' },
        type: { type: 'string', enum: ['run', 'strength', 'recovery', 'mobility', 'cardio', 'rest', 'other'] },
        duration_min: { type: 'integer' },
        intensity: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
        description: { type: 'string' },
        status: { type: 'string', enum: ['planned', 'completed', 'skipped'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_training_session',
    description: 'Remove a planned session from the calendar. Use the [id: ...] from the Training Calendar context.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The session id to delete' } },
      required: ['id'],
    },
  },
  {
    name: 'log_injury',
    description: 'Record an injury the athlete mentions (e.g. "my knee hurts", "tweaked my hamstring"). Once logged, you must account for it in all future advice until it is resolved.',
    input_schema: {
      type: 'object',
      properties: {
        body_part: { type: 'string', description: 'e.g. "left knee", "lower back", "right hamstring"' },
        severity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
        description: { type: 'string', description: 'What happened / how it feels' },
      },
      required: ['body_part'],
    },
  },
  {
    name: 'resolve_injury',
    description: 'Mark an injury as resolved/healed. Use the [id: ...] from the Active Injuries context.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The injury id to resolve' } },
      required: ['id'],
    },
  },
];

type ToolResult = { mutated: 'training' | 'injuries' | null; content: string };

async function runTool(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (name === 'create_training_session') {
      const { error } = await admin.from('training_sessions').insert({
        user_id: userId,
        date: input.date,
        title: input.title,
        type: input.type ?? null,
        duration_min: input.duration_min ?? null,
        intensity: input.intensity ?? null,
        description: input.description ?? null,
        created_by: 'coach',
      });
      if (error) return { mutated: null, content: `Failed: ${error.message}` };
      return { mutated: 'training', content: `Added "${input.title}" on ${input.date}.` };
    }
    if (name === 'update_training_session') {
      const { id, ...rest } = input;
      const fields: Record<string, unknown> = {};
      for (const k of ['date', 'title', 'type', 'duration_min', 'intensity', 'description', 'status']) {
        if (k in rest) fields[k] = rest[k];
      }
      const { error } = await admin.from('training_sessions').update(fields).eq('id', id).eq('user_id', userId);
      if (error) return { mutated: null, content: `Failed: ${error.message}` };
      return { mutated: 'training', content: `Updated session ${id}.` };
    }
    if (name === 'delete_training_session') {
      const { error } = await admin.from('training_sessions').delete().eq('id', input.id).eq('user_id', userId);
      if (error) return { mutated: null, content: `Failed: ${error.message}` };
      return { mutated: 'training', content: `Removed session ${input.id}.` };
    }
    if (name === 'log_injury') {
      const { error } = await admin.from('injuries').insert({
        user_id: userId,
        body_part: input.body_part,
        severity: input.severity ?? 'moderate',
        description: input.description ?? null,
        status: 'active',
        started_on: new Date().toISOString().split('T')[0],
      });
      if (error) return { mutated: null, content: `Failed: ${error.message}` };
      return { mutated: 'injuries', content: `Logged injury: ${input.body_part}.` };
    }
    if (name === 'resolve_injury') {
      const { error } = await admin.from('injuries')
        .update({ status: 'resolved', resolved_on: new Date().toISOString().split('T')[0] })
        .eq('id', input.id).eq('user_id', userId);
      if (error) return { mutated: null, content: `Failed: ${error.message}` };
      return { mutated: 'injuries', content: `Marked injury ${input.id} resolved.` };
    }
    return { mutated: null, content: `Unknown tool: ${name}` };
  } catch (e) {
    return { mutated: null, content: `Error: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messages } = await request.json();
  const admin = createAdminClient();

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const next21 = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const [snapshotsRes, injuriesRes, sessionsRes] = await Promise.all([
    admin.from('health_snapshots').select('*').eq('user_id', user.id).gte('date', since30).order('date', { ascending: true }),
    admin.from('injuries').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }),
    admin.from('training_sessions').select('*').eq('user_id', user.id).gte('date', past7).lte('date', next21).order('date', { ascending: true }),
  ]);

  let activeObjective: { title: string; description?: string | null; target_date?: string | null } | null = null;
  try {
    const { data: objectives } = await admin.from('objectives').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
    activeObjective = objectives?.[0] ?? null;
  } catch { /* table may not exist yet */ }

  let recentActivities: Array<Record<string, unknown>> = [];
  try {
    const storage = createSupabaseTokenStorage(user.id);
    const tokens = await storage.load();
    if (tokens?.oauth1Token) {
      const garmin = new GarminClient('', '', storage);
      recentActivities = (await garmin.getActivities(10, 0)) as Array<Record<string, unknown>>;
    }
  } catch { /* skip if Garmin unavailable */ }

  const healthContext = buildHealthContext(
    (snapshotsRes.data ?? []) as Array<Record<string, unknown>>,
    activeObjective,
    recentActivities,
    (injuriesRes.data ?? []) as Injury[],
    (sessionsRes.data ?? []) as TrainingSession[],
  );

  const systemPrompt = `You are an elite personal coach with deep expertise in endurance sport, strength and conditioning, recovery physiology, injury management, and interpreting wearable data. You coach this specific athlete and you know their numbers.

${healthContext}

## How you talk
You talk like a real coach who knows this person, not a chatbot or a report generator. Short, direct sentences. Warm but no filler. Never open with "Great question" or "Certainly". Just answer.

Reference their actual numbers naturally ("your HRV was 62 last night, that's solid"), not as a data dump.

Never use em-dashes (the long dash). Use a comma or a new sentence. Never use bullet points unless they ask for a structured plan.

Keep replies to the length of a voice note from a coach, unless they ask for a full written plan.

## Using your tools
You can manage this athlete's training calendar and injury list directly. Use the tools, do not just describe what you would do.

When they ask you to plan workouts, build a week, or schedule training, call create_training_session for each session. Build the plan around their objective, recovery data, and any active injuries. After creating sessions, briefly tell them what you put on the calendar in plain language.

When they mention pain or an injury, call log_injury, then adjust your advice. When they say something has healed, call resolve_injury. If they ask to change or remove a planned session, use update_training_session or delete_training_session with the id from the calendar context.

Every active injury must shape your advice. Never program through an injured area. If they have an objective, point every suggestion toward it.`;

  const encoder = new TextEncoder();
  let mutatedTraining = false;
  let mutatedInjuries = false;
  let finalText = '';

  // Manual agentic loop: run tool turns until the model is done. We resolve the
  // whole turn first (Haiku is fast and replies are short) so the mutation
  // header is accurate, then stream the text back for a natural typing feel.
  const convo: Anthropic.MessageParam[] = [...messages];
  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        tools: TOOLS,
        messages: convo,
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (response.stop_reason === 'tool_use' && toolUses.length > 0) {
        convo.push({ role: 'assistant', content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const r = await runTool(admin, user.id, tu.name, tu.input as Record<string, unknown>);
          if (r.mutated === 'training') mutatedTraining = true;
          if (r.mutated === 'injuries') mutatedInjuries = true;
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content });
        }
        convo.push({ role: 'user', content: results });
        continue;
      }

      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      break;
    }
  } catch (err) {
    finalText = `Sorry, I ran into an error: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  if (!finalText) finalText = 'I had trouble putting that together, can you try rephrasing?';
  const clean = finalText.replace(/—|–/g, ',');

  const stream = new ReadableStream({
    async start(controller) {
      const chunkSize = 4;
      for (let i = 0; i < clean.length; i += chunkSize) {
        controller.enqueue(encoder.encode(clean.slice(i, i + chunkSize)));
        if (i % 40 === 0) await new Promise((r) => setTimeout(r, 8));
      }
      controller.close();
    },
  });

  const mutated = [mutatedTraining ? 'training' : null, mutatedInjuries ? 'injuries' : null].filter(Boolean).join(',');
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Client refreshes calendar/injury panels when these change.
      'X-Coach-Mutated': mutated,
    },
  });
}
