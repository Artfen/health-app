'use client';

import { useState } from 'react';
import { Users, Copy, Check, Plus, ArrowRight, Steps, Moon, Heartbeat, BatteryFull, Timer, Trophy, X, Pulse, Gauge, Flame } from '@phosphor-icons/react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { useI18n } from '@/lib/i18n/I18nProvider';

export type Member = { id: string; full_name: string | null; email: string; garmin_display_name: string | null };
export type Snapshot = { date: string; steps: number | null; sleep_seconds: number | null; hrv_last_night: number | null; body_battery_high: number | null; body_battery_current: number | null; active_seconds: number | null; calories: number | null; resting_hr: number | null; vo2_max: number | null };
export type GroupData = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  members: Member[];
  memberSnapshots: Record<string, Snapshot[]>;
};

const MEMBER_COLORS = ['#e8521c', '#6366f1', '#16a34a', '#ec4899', '#0891b2', '#d97706'];

function getName(m: Member) {
  return m.full_name?.split(' ')[0] ?? m.email.split('@')[0] ?? 'User';
}

function avg(snaps: Snapshot[], key: keyof Snapshot) {
  const vals = snaps.map((s) => s[key] as number | null).filter((v): v is number => v !== null);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function fmtShortDate(dateStr: string, localeTag: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(localeTag, { weekday: 'short' });
}

function fmtSleep(seconds: number) {
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--text-1)', color: '#fff' }}>
      <p className="opacity-60 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value?.toLocaleString()}</span></p>
      ))}
    </div>
  );
};

function Leaderboard({ label, icon, members, memberSnapshots, snapKey, color, formatFn, lowerBetter, avgLabel }: {
  label: string; icon: React.ReactNode; members: Member[]; memberSnapshots: Record<string, Snapshot[]>;
  snapKey: keyof Snapshot; color: string; formatFn?: (v: number) => string; lowerBetter?: boolean; avgLabel: string;
}) {
  const ranked = members.map((m) => ({ member: m, value: avg(memberSnapshots[m.id] ?? [], snapKey) }))
    .sort((a, b) => lowerBetter
      ? (a.value === 0 ? 1 : b.value === 0 ? -1 : a.value - b.value)
      : b.value - a.value);
  const max = Math.max(1, ...ranked.map((r) => r.value));

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color }}>{icon}</span>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{label}</p>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>{avgLabel}</span>
      </div>
      <div className="flex flex-col gap-3">
        {ranked.map(({ member, value }, i) => (
          <div key={member.id} className="flex items-center gap-3">
            <span className="text-xs font-mono w-4 font-bold" style={{ color: i === 0 ? '#d97706' : 'var(--text-3)' }}>{i + 1}</span>
            <span className="text-sm font-medium w-16 truncate" style={{ color: 'var(--text-2)' }}>{getName(member)}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold w-16 text-right" style={{ color: 'var(--text-1)' }}>
              {formatFn ? formatFn(value) : value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' };

export default function GroupClient({ userId, groups }: { userId: string; groups: GroupData[] }) {
  const { t, localeTag } = useI18n();
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<null | 'create' | 'join'>(groups.length === 0 ? null : null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const group = groups[Math.min(selected, Math.max(0, groups.length - 1))] ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const url = mode === 'create' ? '/api/group/create' : '/api/group/join';
    const body = mode === 'create' ? { name: text } : { inviteCode: text };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    if (res.ok) window.location.reload();
    else setError((await res.json()).error ?? t('common.error'));
  }

  function copyCode() {
    if (!group) return;
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ---- Empty state: no groups yet ----
  if (groups.length === 0) {
    return (
      <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{t('nav.group')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{t('group.subtitle')}</p>
        </div>
        {mode === null ? (
          <div className="rounded-2xl p-10 text-center max-w-md mx-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Users size={28} />
            </div>
            <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-1)' }}>{t('group.emptyTitle')}</p>
            <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--text-2)' }}>
              {t('group.emptyDesc')}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setMode('create'); setText(''); setError(''); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--accent)', color: '#fff' }}>
                <Plus size={16} /> {t('group.createGroup')}
              </button>
              <button onClick={() => { setMode('join'); setText(''); setError(''); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                <ArrowRight size={16} /> {t('group.joinWithCode')}
              </button>
            </div>
          </div>
        ) : (
          <CreateJoinForm mode={mode} text={text} setText={setText} error={error} loading={loading} submit={submit} onCancel={() => setMode(null)} t={t} inline />
        )}
      </div>
    );
  }

  const members = group!.members;
  const memberSnapshots = group!.memberSnapshots;
  const allDates = [...new Set(Object.values(memberSnapshots).flat().map((s) => s.date))].sort();

  const stepsData = allDates.map((date) => {
    const entry: Record<string, string | number> = { date: fmtShortDate(date, localeTag) };
    members.forEach((m) => { entry[getName(m)] = memberSnapshots[m.id]?.find((s) => s.date === date)?.steps ?? 0; });
    return entry;
  });

  const radarData = [
    { metric: 'Steps', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, Math.round(avg(memberSnapshots[m.id] ?? [], 'steps') / 100))])) },
    { metric: 'Sleep', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, Math.round(avg(memberSnapshots[m.id] ?? [], 'sleep_seconds') / 3600 * 12.5))])) },
    { metric: 'HRV', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, avg(memberSnapshots[m.id] ?? [], 'hrv_last_night'))])) },
    { metric: 'Battery', ...Object.fromEntries(members.map((m) => [getName(m), avg(memberSnapshots[m.id] ?? [], 'body_battery_high')])) },
    { metric: 'Active', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, Math.round(avg(memberSnapshots[m.id] ?? [], 'active_seconds') / 60))])) },
  ];

  const hasData = allDates.length > 0;

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{group!.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{t('group.members', { count: members.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMode('join'); setText(''); setError(''); }} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <ArrowRight size={14} /> {t('common.join')}
          </button>
          <button onClick={() => { setMode('create'); setText(''); setError(''); }} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <Plus size={14} /> {t('common.new')}
          </button>
          <button onClick={copyCode} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }}>
            {copied ? <Check size={15} style={{ color: 'var(--green)' }} /> : <Copy size={15} />}
            <span className="font-mono tracking-widest text-xs">{group!.invite_code}</span>
          </button>
        </div>
      </div>

      {/* Group switcher */}
      {groups.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {groups.map((g, i) => (
            <button key={g.id} onClick={() => setSelected(i)}
              className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              style={i === selected
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              {g.name}
              <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{g.members.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Member chips */}
      <div className="flex gap-3 flex-wrap mb-6">
        {members.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
              {getName(m)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>{getName(m)}</p>
              {m.garmin_display_name && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{m.garmin_display_name}</p>}
            </div>
            {m.id === userId && <span className="text-xs px-1.5 py-0.5 rounded font-medium ml-1" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{t('group.youBadge')}</span>}
          </div>
        ))}
      </div>

      {/* No-data hint */}
      {!hasData && (
        <div className="rounded-2xl p-6 text-center mb-6" style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{t('group.noDataTitle')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {t('group.noDataDesc')}
          </p>
        </div>
      )}

      {/* Leaderboards */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} style={{ color: '#d97706' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('group.leaderboardTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Leaderboard label={t('metrics.steps')} avgLabel={t('group.sevenDayAvg')} icon={<Steps size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="steps" color={MEMBER_COLORS[0]!} />
          <Leaderboard label={t('metrics.sleep')} avgLabel={t('group.sevenDayAvg')} icon={<Moon size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="sleep_seconds" color="#6366f1" formatFn={(v) => v ? fmtSleep(v) : '--'} />
          <Leaderboard label={t('metrics.hrv')} avgLabel={t('group.sevenDayAvg')} icon={<Heartbeat size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="hrv_last_night" color="#16a34a" formatFn={(v) => `${v} ms`} />
          <Leaderboard label={t('metrics.bodyBattery')} avgLabel={t('group.sevenDayAvg')} icon={<BatteryFull size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="body_battery_high" color="#d97706" />
          <Leaderboard label={t('metrics.activeTime')} avgLabel={t('group.sevenDayAvg')} icon={<Timer size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="active_seconds" color="#06b6d4" formatFn={(v) => `${Math.floor(v / 60)} min`} />
          <Leaderboard label={t('metrics.restingHr')} avgLabel={t('group.sevenDayAvg')} icon={<Pulse size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="resting_hr" color="#ec4899" formatFn={(v) => v ? `${v} bpm` : '--'} lowerBetter />
          <Leaderboard label={t('metrics.vo2max')} avgLabel={t('group.sevenDayAvg')} icon={<Gauge size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="vo2_max" color="#10b981" />
          <Leaderboard label={t('metrics.calories')} avgLabel={t('group.sevenDayAvg')} icon={<Flame size={15} />} members={members} memberSnapshots={memberSnapshots} snapKey="calories" color="#f97316" formatFn={(v) => v ? `${v.toLocaleString()} kcal` : '--'} />
        </div>
      </div>

      {/* Charts */}
      {members.length >= 2 && hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>{t('group.healthRadar')}</p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                {members.map((m, i) => (
                  <Radar key={m.id} name={getName(m)} dataKey={getName(m)} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} fillOpacity={0.12} />
                ))}
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>{t('group.stepsComparison')}</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stepsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {members.map((m, i) => (
                  <Line key={m.id} type="monotone" dataKey={getName(m)} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Create / Join modal */}
      {mode !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setMode(null); }}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{mode === 'create' ? t('group.createTitle') : t('group.joinTitle')}</h3>
              <button onClick={() => setMode(null)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
            </div>
            <CreateJoinForm mode={mode} text={text} setText={setText} error={error} loading={loading} submit={submit} onCancel={() => setMode(null)} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateJoinForm({ mode, text, setText, error, loading, submit, onCancel, t, inline }: {
  mode: 'create' | 'join'; text: string; setText: (s: string) => void; error: string; loading: boolean;
  submit: (e: React.FormEvent) => void; onCancel: () => void; t: (key: string, vars?: Record<string, string | number>) => string; inline?: boolean;
}) {
  return (
    <form onSubmit={submit} className={inline ? 'flex flex-col gap-4 rounded-2xl p-6 max-w-sm mx-auto' : 'flex flex-col gap-4'}
      style={inline ? { background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' } : undefined}>
      {inline && <h2 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{mode === 'create' ? t('group.createTitle') : t('group.joinTitle')}</h2>}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{mode === 'create' ? t('group.groupNameLabel') : t('group.inviteCodeLabel')}</label>
        <input type="text" value={text}
          onChange={(e) => setText(mode === 'create' ? e.target.value : e.target.value.toUpperCase())}
          placeholder={mode === 'create' ? t('group.groupNamePlaceholder') : t('group.inviteCodePlaceholder')}
          required autoFocus className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
          {loading ? t('common.loading') : mode === 'create' ? t('common.create') : t('common.join')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
