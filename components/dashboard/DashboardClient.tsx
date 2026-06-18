'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
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
  NotePencil,
  X,
  Gauge,
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
  body_battery_current: number | null;
  vo2_max: number | null;
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

function fmtShortDate(dateStr: string, localeTag: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(localeTag, { weekday: 'short' });
}

function fmtDate(dateStr: string, localeTag: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(localeTag, {
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

function StatCard({ label, value, sub, trend, accent, icon, href }: {
  label: string; value: string; sub: string; trend?: number | null; accent?: boolean; icon: React.ReactNode; href: string;
}) {
  const [hovered, setHovered] = useState(false);
  const up = trend != null && trend > 0;
  const down = trend != null && trend < 0;
  return (
    <Link href={href} prefetch={true}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150"
      style={{
        background: accent
          ? hovered ? '#d4481a' : 'var(--accent)'
          : hovered ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
        boxShadow: hovered ? 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.10))' : 'var(--shadow-sm)',
        border: accent ? 'none' : hovered ? '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))' : '1px solid var(--border)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        cursor: 'pointer',
      }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
          style={{
            background: accent ? 'rgba(255,255,255,0.18)' : hovered ? 'color-mix(in srgb, var(--accent) 15%, var(--surface-2))' : 'var(--surface-2)',
            color: accent ? '#fff' : 'var(--accent)',
          }}>
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
    </Link>
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
  const router = useRouter();
  const { t, localeTag } = useI18n();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [logSaving, setLogSaving] = useState(false);
  const [logForm, setLogForm] = useState<Record<string, string>>({
    date: new Date().toISOString().split('T')[0]!,
  });

  async function saveLog() {
    setLogSaving(true);
    const res = await fetch('/api/manual-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logForm),
    });
    setLogSaving(false);
    if (res.ok) {
      setLogOpen(false);
      window.location.href = '/dashboard';
    }
  }

  const name = profile?.full_name?.split(' ')[0] ?? t('dashboard.fallbackName');
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t('dashboard.greetingMorning', { name })
    : hour < 18
      ? t('dashboard.greetingAfternoon', { name })
      : t('dashboard.greetingEvening', { name });

  async function syncToday() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        setSyncing(false);
        setSyncMsg(d.error ?? t('dashboard.syncFailed'));
      }
    } catch {
      setSyncing(false);
      setSyncMsg(t('dashboard.networkError'));
    }
  }

  const snap = todaySnapshot;
  const prevSnap = weekSnapshots[weekSnapshots.length - 2] ?? null;

  const stepsTrend = snap?.steps && prevSnap?.steps
    ? Math.round(((snap.steps - prevSnap.steps) / prevSnap.steps) * 100) : null;
  const sleepTrend = snap?.sleep_seconds && prevSnap?.sleep_seconds
    ? Math.round(((snap.sleep_seconds - prevSnap.sleep_seconds) / prevSnap.sleep_seconds) * 100) : null;

  // Build a continuous 7-day window ending today so the chart reads as a real
  // timeline — days without a snapshot show as empty slots instead of the bars
  // collapsing together. Empty when the user has no data at all.
  const byDate = new Map(weekSnapshots.map((s) => [s.date, s]));
  const chartData = weekSnapshots.length === 0 ? [] : Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const s = byDate.get(key);
    return {
      date: fmtShortDate(key, localeTag),
      steps: s?.steps ?? 0,
      hrv: s?.hrv_last_night ? Math.round(s.hrv_last_night) : 0,
      sleep: s?.sleep_seconds ? Math.round(s.sleep_seconds / 3600 * 10) / 10 : 0,
      battery: s?.body_battery_high ?? 0,
    };
  });

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            {greeting}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && (
            <span className="text-xs px-3 py-1.5 rounded-lg hidden sm:block"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {syncMsg}
            </span>
          )}
          <button onClick={() => { setLogForm({ date: new Date().toISOString().split('T')[0]! }); setLogOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
            style={
              profile?.garmin_connected
                ? { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }
                : { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }
            }>
            <NotePencil size={15} />
            <span className="hidden sm:inline">{t('dashboard.log')}</span>
          </button>
          {profile?.garmin_connected && (
            <button onClick={syncToday} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }}>
              <ArrowClockwise size={15} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{t('dashboard.syncNow')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Garmin connect banner */}
      {!profile?.garmin_connected && (
        <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-6"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div className="flex items-center gap-3">
            <WifiHigh size={20} style={{ color: 'var(--amber)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>{t('dashboard.connectBanner.title')}</p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>{t('dashboard.connectBanner.desc')}</p>
            </div>
          </div>
          <Link href="/onboarding"
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--amber)', color: '#fff' }}>
            {t('dashboard.connectBanner.action')}
          </Link>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-12 gap-5">

        {/* Left: stats + charts */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label={t('dashboard.stepsToday')} value={snap?.steps?.toLocaleString() ?? '--'} sub={t('dashboard.stepsGoal')}
              trend={stepsTrend} accent href="/activities" icon={<Steps size={16} />} />
            <StatCard label={t('metrics.sleep')} value={fmtSleep(snap?.sleep_seconds ?? null)}
              sub={snap?.sleep_score ? t('dashboard.sleepScoreSub', { score: snap.sleep_score }) : t('dashboard.lastNight')} trend={sleepTrend} href="/sleep" icon={<Moon size={16} />} />
            <StatCard label={t('metrics.hrv')} value={snap?.hrv_last_night ? `${Math.round(snap.hrv_last_night)} ms` : '--'}
              sub={snap?.hrv_status ?? t('dashboard.lastNight')} href="/sleep" icon={<Heartbeat size={16} />} />
            <StatCard label={t('metrics.bodyBattery')} value={snap?.body_battery_current != null ? `${snap.body_battery_current}` : snap?.body_battery_high != null ? `${snap.body_battery_high}` : '--'}
              sub={snap?.body_battery_high != null ? t('dashboard.peak', { value: snap.body_battery_high }) : t('dashboard.now')} href="/activities" icon={<BatteryFull size={16} />} />
          </div>

          {/* Steps bar chart */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('dashboard.stepsChart.title')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t('dashboard.stepsChart.subtitle')}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--accent)' }} />
                {t('dashboard.stepsChart.legendToday')}
                <span className="w-2.5 h-2.5 rounded-sm inline-block ml-2" style={{ background: 'var(--border)' }} />
                {t('dashboard.stepsChart.legendPrevious')}
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
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('dashboard.stepsChart.empty')}</p>
              </div>
            )}
          </div>

          {/* HRV + Sleep mini charts */}
          <div className="grid grid-cols-2 gap-4">
            <MiniChart title={t('dashboard.hrvChartTitle')} noDataLabel={t('dashboard.noData')} data={chartData} dataKey="hrv" color="#16a34a" unit="ms" href="/sleep" />
            <MiniChart title={t('dashboard.sleepChartTitle')} noDataLabel={t('dashboard.noData')} data={chartData} dataKey="sleep" color="#6366f1" unit="hrs" href="/sleep" />
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

          {/* Today detail list */}
          <HoverPanel href="/activities">
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>{t('common.today')}</p>
            <div className="flex flex-col">
              {[
                { icon: <Lightning size={14} />, label: t('dashboard.detailAvgStress'), value: snap?.avg_stress ? `${snap.avg_stress}` : '--', color: '#e8521c' },
                { icon: <Flame size={14} />, label: t('dashboard.detailCalories'), value: snap?.calories?.toLocaleString() ?? '--', color: '#f97316' },
                { icon: <Heartbeat size={14} />, label: t('dashboard.detailRestingHr'), value: snap?.resting_hr ? `${snap.resting_hr} bpm` : '--', color: '#ec4899' },
                { icon: <Gauge size={14} />, label: t('dashboard.detailVo2Max'), value: snap?.vo2_max ? `${snap.vo2_max}` : '--', color: '#10b981' },
                { icon: <Timer size={14} />, label: t('dashboard.detailActiveTime'), value: snap?.active_seconds ? `${Math.floor(snap.active_seconds / 60)} min` : '--', color: '#06b6d4' },
                { icon: <Steps size={14} />, label: t('dashboard.detailDistance'), value: snap?.distance_meters ? `${(snap.distance_meters / 1000).toFixed(1)} km` : '--', color: '#8b5cf6' },
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
          </HoverPanel>

          {/* Body battery gauge */}
          <HoverPanel href="/activities">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('metrics.bodyBattery')}</p>
              <BatteryFull size={16} style={{ color: 'var(--accent)' }} />
            </div>
            {(() => {
              const bb = snap?.body_battery_current ?? snap?.body_battery_high ?? null;
              return (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <p className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                      {bb ?? '--'}
                    </p>
                    {bb != null && <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('dashboard.bodyBatteryOutOf')}</p>}
                  </div>
                  {bb != null && (
                    <>
                      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full"
                          style={{
                            width: `${bb}%`,
                            background: bb > 70 ? 'var(--green)' : bb > 40 ? 'var(--amber)' : 'var(--red)',
                          }} />
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                        <span>{t('dashboard.bodyBatteryLow', { value: snap?.body_battery_low ?? '--' })}</span>
                        <span>{t('dashboard.bodyBatteryPeak', { value: snap?.body_battery_high ?? '--' })}</span>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </HoverPanel>

          {/* Quick nav tiles */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/calendar', label: t('dashboard.tiles.calendar'), desc: t('dashboard.tiles.calendarDesc'), color: 'var(--accent)' },
              { href: '/coach', label: t('dashboard.tiles.coach'), desc: t('dashboard.tiles.coachDesc'), color: '#d97706' },
              { href: '/sleep', label: t('dashboard.tiles.sleep'), desc: t('dashboard.tiles.sleepDesc'), color: '#6366f1' },
              { href: '/activities', label: t('dashboard.tiles.activities'), desc: t('dashboard.tiles.activitiesDesc'), color: '#06b6d4' },
              { href: '/group', label: t('dashboard.tiles.group'), desc: t('dashboard.tiles.groupDesc'), color: '#16a34a' },
              { href: '/team', label: t('dashboard.tiles.team'), desc: t('dashboard.tiles.teamDesc'), color: '#db2777' },
            ].map(({ href, label, desc, color }) => (
              <NavTile key={href} href={href} label={label} desc={desc} color={color} />
            ))}
          </div>
        </div>
      </div>

      {/* Manual log modal */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setLogOpen(false); }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{t('dashboard.modal.title')}</h3>
              <button onClick={() => setLogOpen(false)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
            </div>
            <p className="text-xs mb-5" style={{ color: 'var(--text-3)' }}>
              {t('dashboard.modal.hint')}
            </p>

            <div className="flex flex-col gap-3.5">
              <LogField label={t('dashboard.modal.date')}>
                <input type="date" value={logForm.date ?? ''} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={logInputStyle} />
              </LogField>

              <div className="grid grid-cols-2 gap-3">
                <LogField label={t('dashboard.modal.steps')}><LogInput k="steps" placeholder="8000" form={logForm} set={setLogForm} /></LogField>
                <LogField label={t('dashboard.modal.calories')}><LogInput k="calories" placeholder="2200" form={logForm} set={setLogForm} /></LogField>
              </div>

              <LogField label={t('dashboard.modal.sleep')}>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-1.5 px-3 rounded-xl" style={logInputStyle}>
                    <LogInput k="sleep_hours" placeholder="7" form={logForm} set={setLogForm} bare />
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>h</span>
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 px-3 rounded-xl" style={logInputStyle}>
                    <LogInput k="sleep_minutes" placeholder="30" form={logForm} set={setLogForm} bare />
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>m</span>
                  </div>
                </div>
              </LogField>

              <div className="grid grid-cols-2 gap-3">
                <LogField label={t('dashboard.modal.restingHr')}><LogInput k="resting_hr" placeholder="55" form={logForm} set={setLogForm} /></LogField>
                <LogField label={t('dashboard.modal.hrv')}><LogInput k="hrv_last_night" placeholder="60" form={logForm} set={setLogForm} /></LogField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LogField label={t('dashboard.modal.bodyBattery')}><LogInput k="body_battery_high" placeholder="80" form={logForm} set={setLogForm} /></LogField>
                <LogField label={t('dashboard.modal.avgStress')}><LogInput k="avg_stress" placeholder="30" form={logForm} set={setLogForm} /></LogField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LogField label={t('dashboard.modal.vo2max')}><LogInput k="vo2_max" placeholder="48" form={logForm} set={setLogForm} /></LogField>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LogField label={t('dashboard.modal.distance')}><LogInput k="distance_km" placeholder="5" form={logForm} set={setLogForm} /></LogField>
                <LogField label={t('dashboard.modal.activeMinutes')}><LogInput k="active_minutes" placeholder="45" form={logForm} set={setLogForm} /></LogField>
              </div>

              <button onClick={saveLog} disabled={logSaving}
                className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 mt-1"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {logSaving ? t('common.saving') : t('dashboard.modal.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const logInputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-1)',
};

function LogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  );
}

function LogInput({ k, placeholder, form, set, bare }: {
  k: string; placeholder: string; form: Record<string, string>; set: (f: Record<string, string>) => void; bare?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={form[k] ?? ''}
      onChange={(e) => set({ ...form, [k]: e.target.value })}
      placeholder={placeholder}
      className={bare ? 'w-full py-2.5 text-sm outline-none bg-transparent' : 'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none'}
      style={bare ? { color: 'var(--text-1)' } : logInputStyle}
    />
  );
}

function HoverPanel({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} prefetch={true}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-5 block transition-all duration-150"
      style={{
        background: hovered ? 'color-mix(in srgb, var(--accent) 5%, var(--surface))' : 'var(--surface)',
        border: hovered ? '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))' : '1px solid var(--border)',
        boxShadow: hovered ? 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.10))' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        cursor: 'pointer',
      }}>
      {children}
    </Link>
  );
}

function NavTile({ href, label, desc, color }: { href: string; label: string; desc: string; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl p-4 flex flex-col gap-1 transition-all duration-150 cursor-pointer"
      style={{
        background: hovered ? 'color-mix(in srgb, var(--accent) 10%, var(--surface-2))' : 'var(--surface-2)',
        border: hovered ? '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))' : '1px solid var(--border)',
      }}
    >
      <div className="w-6 h-1 rounded-full mb-1 transition-all duration-150"
        style={{ background: hovered ? 'var(--accent)' : color }} />
      <p className="text-sm font-semibold transition-colors duration-150"
        style={{ color: hovered ? 'var(--accent)' : 'var(--text-1)' }}>{label}</p>
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{desc}</p>
    </Link>
  );
}

function MiniChart({ title, noDataLabel, data, dataKey, color, unit, href }: {
  title: string;
  noDataLabel: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color: string;
  unit: string;
  href: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} prefetch={true}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-4 block transition-all duration-150"
      style={{
        background: hovered ? 'color-mix(in srgb, var(--accent) 5%, var(--surface))' : 'var(--surface)',
        border: hovered ? '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))' : '1px solid var(--border)',
        boxShadow: hovered ? 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.10))' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        cursor: 'pointer',
      }}>
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-2)' }}>{title}</p>
      {data.some((d) => Number(d[dataKey]) > 0) ? (
        <ResponsiveContainer width="100%" height={75}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -32, bottom: 0 }} barSize={14}>
            <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[75px] flex items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{noDataLabel}</p>
        </div>
      )}
    </Link>
  );
}
