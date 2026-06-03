'use client';

import { useState } from 'react';
import {
  ArrowClockwise,
  Steps,
  Moon,
  Heartbeat,
  Lightning,
  BatteryFull,
  Flame,
  Timer,
  WifiHigh,
} from '@phosphor-icons/react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type Snapshot = {
  date: string;
  steps: number | null;
  calories: number | null;
  active_calories: number | null;
  resting_hr: number | null;
  avg_stress: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  sleep_seconds: number | null;
  deep_sleep_seconds: number | null;
  rem_sleep_seconds: number | null;
  sleep_score: number | null;
  hrv_last_night: number | null;
  hrv_status: string | null;
  distance_meters: number | null;
  active_seconds: number | null;
};

type Profile = {
  full_name: string | null;
  email: string;
  garmin_connected: boolean;
} | null;

function fmtSleep(seconds: number | null) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
};

function MetricCard({ icon, label, value, sub, color }: MetricCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:scale-[1.01]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)' }}>
      <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

export default function DashboardClient({
  profile,
  todaySnapshot,
  weekSnapshots,
  userId,
}: {
  profile: Profile;
  todaySnapshot: Snapshot | null;
  weekSnapshots: Snapshot[];
  userId: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const name = profile?.full_name?.split(' ')[0] ?? 'Athlete';

  async function syncToday() {
    setSyncing(true);
    setSyncMessage('');
    const res = await fetch('/api/garmin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncMessage('Synced! Refresh to see latest data.');
    } else {
      setSyncMessage(data.error ?? 'Sync failed');
    }
  }

  const chartData = weekSnapshots.map((s) => ({
    date: fmtShortDate(s.date),
    Steps: s.steps ?? 0,
    Sleep: s.sleep_seconds ? Math.round(s.sleep_seconds / 3600 * 10) / 10 : 0,
    HRV: s.hrv_last_night ?? 0,
    Battery: s.body_battery_high ?? 0,
  }));

  const t = todaySnapshot;

  return (
    <div className="px-6 py-8 pb-24 lg:pb-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {fmtDate(new Date().toISOString().split('T')[0]!)}
          </p>
        </div>
        <button
          onClick={syncToday}
          disabled={syncing || !profile?.garmin_connected}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
        >
          <ArrowClockwise size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      </div>

      {syncMessage && (
        <p className="text-sm mb-4 px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          {syncMessage}
        </p>
      )}

      {/* Garmin not connected banner */}
      {!profile?.garmin_connected && (
        <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-8" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="flex items-center gap-3">
            <WifiHigh size={20} style={{ color: '#f59e0b' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>Garmin not connected</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Connect your Garmin to start seeing data</p>
            </div>
          </div>
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: '#f59e0b', color: '#1a1a00' }}
          >
            Connect
          </Link>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<Steps size={18} />}
          label="Steps"
          value={t?.steps?.toLocaleString() ?? '--'}
          sub="goal: 10,000"
          color="#6366f1"
        />
        <MetricCard
          icon={<Moon size={18} />}
          label="Sleep"
          value={fmtSleep(t?.sleep_seconds ?? null)}
          sub={t?.sleep_score ? `Score ${t.sleep_score}` : undefined}
          color="#818cf8"
        />
        <MetricCard
          icon={<Heartbeat size={18} />}
          label="HRV"
          value={t?.hrv_last_night ? `${Math.round(t.hrv_last_night)} ms` : '--'}
          sub={t?.hrv_status ?? undefined}
          color="#22c55e"
        />
        <MetricCard
          icon={<BatteryFull size={18} />}
          label="Body Battery"
          value={t?.body_battery_high ? `${t.body_battery_high}` : '--'}
          sub={t?.body_battery_low ? `Low: ${t.body_battery_low}` : undefined}
          color="#f59e0b"
        />
        <MetricCard
          icon={<Lightning size={18} />}
          label="Stress"
          value={t?.avg_stress ? `${t.avg_stress}` : '--'}
          sub="avg today"
          color="#ef4444"
        />
        <MetricCard
          icon={<Flame size={18} />}
          label="Calories"
          value={t?.calories?.toLocaleString() ?? '--'}
          sub={t?.active_calories ? `${t.active_calories} active` : undefined}
          color="#f97316"
        />
        <MetricCard
          icon={<Heartbeat size={18} weight="fill" />}
          label="Resting HR"
          value={t?.resting_hr ? `${t.resting_hr} bpm` : '--'}
          sub="resting"
          color="#ec4899"
        />
        <MetricCard
          icon={<Timer size={18} />}
          label="Active Time"
          value={t?.active_seconds ? `${Math.floor(t.active_seconds / 60)} min` : '--'}
          sub="today"
          color="#06b6d4"
        />
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Steps - 7 days" dataKey="Steps" data={chartData} color="#6366f1" unit="steps" />
          <ChartCard title="Sleep - 7 days" dataKey="Sleep" data={chartData} color="#818cf8" unit="hrs" />
          <ChartCard title="HRV - 7 days" dataKey="HRV" data={chartData} color="#22c55e" unit="ms" />
          <ChartCard title="Body Battery Peak - 7 days" dataKey="Battery" data={chartData} color="#f59e0b" unit="" />
        </div>
      )}

      {chartData.length === 0 && profile?.garmin_connected && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No data yet</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Hit "Sync now" to pull your latest Garmin data.</p>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  dataKey,
  data,
  color,
  unit,
}: {
  title: string;
  dataKey: string;
  data: Array<Record<string, string | number>>;
  color: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm font-medium mb-5" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
