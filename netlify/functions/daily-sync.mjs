// Netlify Scheduled Function — runs daily and triggers the app's cron sync,
// which pulls the last few days of Garmin data for every connected user.
//
// Requires the CRON_SECRET env var (set the SAME value in Netlify site env so
// this function can authenticate to /api/cron/sync). Adjust the schedule below
// (cron syntax, UTC). "0 6 * * *" = 06:00 UTC daily.
export const config = { schedule: '0 6 * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET || '';
  if (!base) return new Response('Missing site URL env', { status: 500 });

  const res = await fetch(`${base}/api/cron/sync`, {
    method: 'POST',
    headers: { 'x-cron-secret': secret },
  });
  const text = await res.text();
  console.log('[daily-sync]', res.status, text.slice(0, 500));
  return new Response(text, { status: res.status });
};
