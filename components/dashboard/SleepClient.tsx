'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

type SleepSnapshot = {
  date: string;
  sleep_seconds: number | null;
  deep_sleep_seconds: number | null;
  rem_sleep_seconds: number | null;
  sleep_score: number | null;
  hrv_last_night: number | null;
  hrv_status: string | null;
};

function toHours(seconds: number | null) {
  if (!seconds) return 0;
  return Math.round((seconds / 3600) * 10) / 10;
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function fmtSleep(seconds: number | null) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)' }}>
      <p className="font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}h</span>
        </p>
      ))}
    </div>
  );
};

const STATUS_COLORS: Record<string, string> = {
  BALANCED: '#22c55e',
  LOW: '#ef4444',
  UNBALANCED: '#f59e0b',
  POOR: '#ef4444',
};

export default function SleepClient({ snapshots }: { snapshots: SleepSnapshot[] }) {
  const latest = snapshots[snapshots.length - 1];

  const chartData = snapshots.map((s) => ({
    date: fmtShortDate(s.date),
    'Deep': toHours(s.deep_sleep_seconds),
    'REM': toHours(s.rem_sleep_seconds),
    'Light': toHours(s.sleep_seconds && s.deep_sleep_seconds && s.rem_sleep_seconds
      ? s.sleep_seconds - s.deep_sleep_seconds - s.rem_sleep_seconds
      : null),
  }));

  return (
    <div className="px-6 py-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Sleep</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Recovery and sleep quality</p>
      </div>

      {/* Latest night summary */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <SleepStat
            label="Total sleep"
            value={fmtSleep(latest.sleep_seconds)}
            color="#818cf8"
          />
          <SleepStat
            label="Deep sleep"
            value={fmtSleep(latest.deep_sleep_seconds)}
            color="#6366f1"
          />
          <SleepStat
            label="REM sleep"
            value={fmtSleep(latest.rem_sleep_seconds)}
            color="#a78bfa"
          />
          <SleepStat
            label="Sleep score"
            value={latest.sleep_score ? `${latest.sleep_score}` : '--'}
            color="#22c55e"
          />
        </div>
      )}

      {/* HRV status */}
      {latest?.hrv_last_night && (
        <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Last night HRV</p>
            <p className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {Math.round(latest.hrv_last_night)} <span className="text-base font-normal" style={{ color: 'var(--text-secondary)' }}>ms</span>
            </p>
          </div>
          {latest.hrv_status && (
            <span
              className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide"
              style={{
                background: `${STATUS_COLORS[latest.hrv_status] ?? '#6366f1'}18`,
                color: STATUS_COLORS[latest.hrv_status] ?? '#6366f1',
              }}
            >
              {latest.hrv_status}
            </span>
          )}
        </div>
      )}

      {/* Sleep stage chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-5" style={{ color: 'var(--text-primary)' }}>Sleep stages - 7 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Bar dataKey="Deep" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="REM" stackId="a" fill="#a78bfa" />
              <Bar dataKey="Light" stackId="a" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {snapshots.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No sleep data yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Sync your Garmin from the dashboard to see sleep data.</p>
        </div>
      )}
    </div>
  );
}

function SleepStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-semibold tracking-tight" style={{ color }}>{value}</p>
    </div>
  );
}
