'use client';

import { useState } from 'react';
import {
  ArrowClockwise,
  Steps,
  Moon,
  Heartbeat,
  BatteryFull,
  Lightning,
  Flame,
  Timer,
  WifiHigh,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
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

type Profile = { full_name: string | null; email: string; garmin_connected: boolean } | null;

function fmtSleep(seconds: number | null) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
      style={{ background: 'var(--text-1)', color: '#fff' }}>
      <p className="opacity-60 text-[10px] mb-0.5">{label}</p>
      <p>{payload[0]?.value?.toLocaleString()}</p>
    </div>
  );
};

function StatCard({ label, value, sub, trend, accent, icon }: {
  label: string; value: string; sub: string; trend?: number | null; accent?: boolean; icon: React.ReactNode;
}) {
  const up = trend != null && trend > 0;
  const down = trend != null && trend < 0;
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: accent ? 'var(--accent)' : 'var(--surface)',
        boxShadow: 'var(--shadow-sm)',
        border: accent ? 'none' : '1px solid var(--border)',
      }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: accent ? 'rgba(255,255,255,0.18)' : 'var(--surface-2)', color: accent ? '#fff' : 'var(--accent)' }}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: accent ? '#fff' : 'var(--text-1)' }}>
          {value}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {trend != null && (
            <span className="flex items-center gap-0.5 text-xs font-semibold"
              style={{ color: accent ? 'rgba(255,255,255,0.85)' : up ? 'var(--green)' : down ? 'var(--red)' : 'var(--text-3)' }}>
              {up ? <TrendUp size={11} /> : down ? <TrendDown size={11} /> : null}
              {Math.abs(trend)}%
            </span>
          )}
          <span className="text-xs" style={{ color: accent ? 'rgba(255,255,255,0.55)' : 'var(--text-3)' }}>
            {sub}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient({
  profile,
  todaySnapshot,
  weekSnapshots,
}: {
  profile: Profile;
  todaySnapshot: Snapshot | null;
  weekSnapshots: Snapshot[];
  userId: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const name = profile?.full_name?.split(' ')[0] ?? 'Athlete';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  async function syncToday() {
    setSyncing(true);
    setSyncMsg('');
    const res = await fetch('/api/garmin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const d = await res.json();
    setSyncing(false);
    setSyncMsg(res.ok ? 'Synced - refresh to see latest.' : (d.error ?? 'Sync failed'));
  }

  const t = todaySnapshot;
  const prevSnap = weekSnapshots[weekSnapshots.length - 2] ?? null;

  const stepsTrend = t?.steps && prevSnap?.steps
    ? Math.round(((t.steps - prevSnap.steps) / prevSnap.steps) * 100) : null;
  const sleepTrend = t?.sleep_seconds && prevSnap?.sleep_seconds
    ? Math.round(((t.sleep_seconds - prevSnap.sleep_seconds) / prevSnap.sleep_seconds) * 100) : null;

  const chartData = weekSnapshots.map((s) => ({
    date: fmtShortDate(s.date),
    steps: s.steps ?? 0,
    hrv: s.hrv_last_night ? Math.round(s.hrv_last_night) : 0,
    sleep: s.sleep_seconds ? Math.round(s.sleep_seconds / 3600 * 10) / 10 : 0,
    battery: s.body_battery_high ?? 0,
  }));

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            {greeting}, {name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            Stay on top of your recovery and training load.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && (
            <span className="text-xs px-3 py-1.5 rounded-lg hidden sm:block"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {syncMsg}
            </span>
          )}
          <button onClick={syncToday} disabled={syncing || !profile?.garmin_connected}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }}>
            <ArrowClockwise size={15} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync now</span>
          </button>
        </div>
      </div>

      {/* Garmin connect banner */}
      {!profile?.garmin_connected && (
        <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-6"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div className="flex items-center gap-3">
            <WifiHigh size={20} style={{ color: 'var(--amber)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Connect your Garmin Fenix</p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Link your account to start syncing health data</p>
            </div>
          </div>
          <Link href="/onboarding"
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--amber)', color: '#fff' }}>
            Connect
          </Link>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-12 gap-5">

        {/* Left: stats + charts */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Steps Today" value={t?.steps?.toLocaleString() ?? '--'} sub="goal: 10k"
              trend={stepsTrend} accent icon={<Steps size={16} />} />
            <StatCard label="Sleep" value={fmtSleep(t?.sleep_seconds ?? null)}
              sub={t?.sleep_score ? `Score ${t.sleep_score}` : 'last night'} trend={sleepTrend} icon={<Moon size={16} />} />
            <StatCard label="HRV" value={t?.hrv_last_night ? `${Math.round(t.hrv_last_night)} ms` : '--'}
              sub={t?.hrv_status ?? 'last night'} icon={<Heartbeat size={16} />} />
            <StatCard label="Body Battery" value={t?.body_battery_high ? `${t.body_battery_high}` : '--'}
              sub={t?.body_battery_low != null ? `Low: ${t.body_battery_low}` : 'peak today'} icon={<BatteryFull size={16} />} />
          </div>

          {/* Steps bar chart */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Daily Steps</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Last 7 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--accent)' }} />
                Today
                <span className="w-2.5 h-2.5 rounded-sm inline-block ml-2" style={{ background: 'var(--border)' }} />
                Previous
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={165}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)', radius: 6 }} />
                  <Bar dataKey="steps" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === chartData.length - 1 ? 'var(--accent)' : '#e2e3eb'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sync to see your step history</p>
              </div>
            )}
          </div>

          {/* HRV + Sleep mini charts */}
          <div className="grid grid-cols-2 gap-4">
            <MiniChart title="HRV - 7 days" data={chartData} dataKey="hrv" color="#16a34a" unit="ms" />
            <MiniChart title="Sleep - 7 days" data={chartData} dataKey="sleep" color="#6366f1" unit="hrs" />
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

          {/* Today detail list */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Today</p>
            <div className="flex flex-col">
              {[
                { icon: <Lightning size={14} />, label: 'Avg Stress', value: t?.avg_stress ? `${t.avg_stress}` : '--', color: '#e8521c' },
                { icon: <Flame size={14} />, label: 'Calories', value: t?.calories?.toLocaleString() ?? '--', color: '#f97316' },
                { icon: <Heartbeat size={14} />, label: 'Resting HR', value: t?.resting_hr ? `${t.resting_hr} bpm` : '--', color: '#ec4899' },
                { icon: <Timer size={14} />, label: 'Active time', value: t?.active_seconds ? `${Math.floor(t.active_seconds / 60)} min` : '--', color: '#06b6d4' },
                { icon: <Steps size={14} />, label: 'Distance', value: t?.distance_meters ? `${(t.distance_meters / 1000).toFixed(1)} km` : '--', color: '#8b5cf6' },
              ].map(({ icon, label, value, color }, i, arr) => (
                <div key={label} className="flex items-center justify-between py-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}18`, color }}>
                      {icon}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Body battery gauge */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Body Battery</p>
              <BatteryFull size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                {t?.body_battery_high ?? '--'}
              </p>
              {t?.body_battery_high && (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>/ 100</p>
              )}
            </div>
            {t?.body_battery_high != null && (
              <>
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: `${t.body_battery_high}%`,
                      background: t.body_battery_high > 70 ? 'var(--green)'
                        : t.body_battery_high > 40 ? 'var(--amber)' : 'var(--red)',
                    }} />
                </div>
                {t.body_battery_low != null && (
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                    <span>Low: {t.body_battery_low}</span>
                    <span>Peak: {t.body_battery_high}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick nav tiles */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/activities', label: 'Activities', desc: 'Training log', color: 'var(--accent)' },
              { href: '/sleep', label: 'Sleep', desc: 'Recovery', color: '#6366f1' },
              { href: '/group', label: 'Group', desc: 'Compete', color: '#16a34a' },
              { href: '/onboarding', label: 'Garmin', desc: 'Connect', color: '#d97706' },
            ].map(({ href, label, desc, color }) => (
              <Link key={href} href={href}
                className="rounded-xl p-4 flex flex-col gap-1 transition-colors"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="w-6 h-1 rounded-full mb-1" style={{ background: color }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniChart({ title, data, dataKey, color, unit }: {
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-2)' }}>{title}</p>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={75}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -32, bottom: 0 }} barSize={14}>
            <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[75px] flex items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>No data</p>
        </div>
      )}
    </div>
  );
}
