import axios from 'axios';

const TERRA_API = 'https://api.tryterra.co/v2';

const headers = () => ({
  'dev-id': process.env.TERRA_DEV_ID!,
  'x-api-key': process.env.TERRA_API_KEY!,
  'Content-Type': 'application/json',
});

export type TerraWidgetSession = {
  session_id: string;
  url: string;
  status: string;
};

export type TerraDailyPayload = {
  user: { user_id: string; provider: string };
  data: Array<{
    metadata: { start_time: string };
    steps_data?: { total_steps?: number };
    calories_data?: { total_burned_calories?: number; net_activity_calories?: number };
    distance_data?: { summary?: { distance_meters?: number } };
    heart_rate_data?: { summary?: { resting_hr_bpm?: number } };
    stress_data?: { avg_stress_level?: number };
    body_battery_data?: { summary?: Array<{ high?: number; low?: number }> };
    active_durations_data?: { activity_seconds?: number };
  }>;
};

export type TerraSleepPayload = {
  user: { user_id: string; provider: string };
  data: Array<{
    metadata: { start_time: string };
    sleep_durations_data?: {
      total_in_bed_duration_seconds?: number;
      asleep_durations_data?: {
        deep_duration_seconds?: number;
        rem_duration_seconds?: number;
      };
    };
    sleep_scores?: { sleep_quality_score?: number };
    hrv_data?: { summary?: { avg_sdnn?: number; rmssd?: number } };
  }>;
};

export type TerraActivityPayload = {
  user: { user_id: string; provider: string };
  data: Array<{
    metadata: { name?: string; start_time: string; type?: number };
    active_durations_data?: { activity_seconds?: number };
    calories_data?: { total_burned_calories?: number };
    distance_data?: { summary?: { distance_meters?: number } };
    movement_data?: { avg_speed_meters_per_second?: number };
    heart_rate_data?: { summary?: { avg_hr_bpm?: number; max_hr_bpm?: number } };
  }>;
};

export async function generateWidgetSession(referenceId: string): Promise<TerraWidgetSession> {
  const res = await axios.post<TerraWidgetSession>(
    `${TERRA_API}/auth/generateWidgetSession`,
    {
      reference_id: referenceId,
      providers: 'APPLE,GARMIN,FITBIT,WHOOP,POLAR,SUUNTO,OURA,WITHINGS',
      auth_success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?terra=connected`,
      auth_failure_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?terra=failed`,
      language: 'en',
    },
    { headers: headers() },
  );
  return res.data;
}

export async function getUser(terraUserId: string) {
  const res = await axios.get(`${TERRA_API}/userInfo?user_id=${terraUserId}`, {
    headers: headers(),
  });
  return res.data;
}

export async function getDailyData(terraUserId: string, startDate: string, endDate: string) {
  const res = await axios.get(`${TERRA_API}/daily`, {
    params: { user_id: terraUserId, start_date: startDate, end_date: endDate, to_webhook: false },
    headers: headers(),
  });
  return res.data;
}

export async function getSleepData(terraUserId: string, startDate: string, endDate: string) {
  const res = await axios.get(`${TERRA_API}/sleep`, {
    params: { user_id: terraUserId, start_date: startDate, end_date: endDate, to_webhook: false },
    headers: headers(),
  });
  return res.data;
}

export async function getActivityData(terraUserId: string, startDate: string, endDate: string) {
  const res = await axios.get(`${TERRA_API}/activity`, {
    params: { user_id: terraUserId, start_date: startDate, end_date: endDate, to_webhook: false },
    headers: headers(),
  });
  return res.data;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.TERRA_WEBHOOK_SECRET;
  if (!secret) return true;
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export function normalizeDailyData(item: TerraDailyPayload['data'][0]) {
  const bb = item.body_battery_data?.summary;
  return {
    steps: item.steps_data?.total_steps ?? null,
    calories: item.calories_data?.total_burned_calories
      ? Math.round(item.calories_data.total_burned_calories)
      : null,
    active_calories: item.calories_data?.net_activity_calories
      ? Math.round(item.calories_data.net_activity_calories)
      : null,
    resting_hr: item.heart_rate_data?.summary?.resting_hr_bpm ?? null,
    avg_stress: item.stress_data?.avg_stress_level
      ? Math.round(item.stress_data.avg_stress_level)
      : null,
    body_battery_high: bb?.[0]?.high ?? null,
    body_battery_low: bb?.[0]?.low ?? null,
    distance_meters: item.distance_data?.summary?.distance_meters
      ? Math.round(item.distance_data.summary.distance_meters)
      : null,
    active_seconds: item.active_durations_data?.activity_seconds ?? null,
  };
}

export function normalizeSleepData(item: TerraSleepPayload['data'][0]) {
  const durations = item.sleep_durations_data;
  return {
    sleep_seconds: durations?.total_in_bed_duration_seconds ?? null,
    deep_sleep_seconds: durations?.asleep_durations_data?.deep_duration_seconds ?? null,
    rem_sleep_seconds: durations?.asleep_durations_data?.rem_duration_seconds ?? null,
    sleep_score: item.sleep_scores?.sleep_quality_score ?? null,
    hrv_last_night: item.hrv_data?.summary?.rmssd ?? item.hrv_data?.summary?.avg_sdnn ?? null,
  };
}
