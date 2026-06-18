'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useI18n } from '@/lib/i18n/I18nProvider';

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

function fmtShortDate(dateStr: string, localeTag: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(localeTag, { weekday: 'short' });
}

function fmtSleep(seconds: number | null) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const STATUS_COLORS: Record<string, string> = {
  BALANCED: '#16a34a', LOW: '#dc2626', UNBALANCED: '#d97706', POOR: '#dc2626',
};

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--text-1)', color: '#fff' }}>
      <p className="opacity-60 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name}>{p.name}: <span className="font-semibold">{p.value}h</span></p>
      ))}
    </div>
  );
};

function SleepStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="w-6 h-1 rounded-full mb-3" style={{ background: color }} />
      <p className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-1)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  );
}

export default function SleepClient({ snapshots }: { snapshots: SleepSnapshot[] }) {
  const { t, localeTag } = useI18n();
  const latest = snapshots[snapshots.length - 1];

  const chartData = snapshots.map((s) => ({
    date: fmtShortDate(s.date, localeTag),
    [t('sleep.legend.deep')]: toHours(s.deep_sleep_seconds),
    [t('sleep.legend.rem')]: toHours(s.rem_sleep_seconds),
    [t('sleep.legend.light')]: toHours(
      s.sleep_seconds && s.deep_sleep_seconds && s.rem_sleep_seconds
        ? s.sleep_seconds - s.deep_sleep_seconds - s.rem_sleep_seconds
        : null
    ),
  }));

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{t('nav.sleep')}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{t('sleep.subtitle')}</p>
      </div>

      {/* HRV banner */}
      {latest?.hrv_last_night && (
        <div className="flex items-center justify-between rounded-2xl px-6 py-4 mb-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{t('sleep.lastNightHrv')}</p>
            <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
              {Math.round(latest.hrv_last_night)}
              <span className="text-base font-normal ml-1" style={{ color: 'var(--text-3)' }}>ms</span>
            </p>
          </div>
          {latest.hrv_status && (
            <span className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide"
              style={{
                background: `${STATUS_COLORS[latest.hrv_status] ?? '#6366f1'}15`,
                color: STATUS_COLORS[latest.hrv_status] ?? '#6366f1',
              }}>
              {t(`sleep.status.${latest.hrv_status}`)}
            </span>
          )}
        </div>
      )}

      {/* Sleep stage stats */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <SleepStat label={t('metrics.totalSleep')} value={fmtSleep(latest.sleep_seconds)} color="#6366f1" />
          <SleepStat label={t('metrics.deepSleep')} value={fmtSleep(latest.deep_sleep_seconds)} color="#4338ca" />
          <SleepStat label={t('metrics.remSleep')} value={fmtSleep(latest.rem_sleep_seconds)} color="#818cf8" />
          <SleepStat label={t('metrics.sleepScore')} value={latest.sleep_score ? `${latest.sleep_score}` : '--'} color="#22c55e" />
        </div>
      )}

      {/* Bar chart */}
      {chartData.length > 0 ? (
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('sleep.stagesTitle')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t('sleep.lastNights', { count: chartData.length })}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
              <Bar dataKey={t('sleep.legend.deep')} stackId="a" fill="#4338ca" radius={[0, 0, 0, 0]} />
              <Bar dataKey={t('sleep.legend.rem')} stackId="a" fill="#818cf8" />
              <Bar dataKey={t('sleep.legend.light')} stackId="a" fill="#c7d2fe" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{t('sleep.emptyTitle')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{t('sleep.emptyDesc')}</p>
        </div>
      )}
    </div>
  );
}
