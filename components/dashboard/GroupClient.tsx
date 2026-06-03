'use client';

import { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Plus,
  ArrowRight,
  Steps,
  Moon,
  Heartbeat,
  BatteryFull,
  Timer,
  Trophy,
} from '@phosphor-icons/react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

type Member = {
  id: string;
  full_name: string | null;
  email: string;
  garmin_display_name: string | null;
};

type Snapshot = {
  date: string;
  steps: number | null;
  sleep_seconds: number | null;
  hrv_last_night: number | null;
  body_battery_high: number | null;
  active_seconds: number | null;
  calories: number | null;
};

type Group = { id: string; name: string; owner_id: string; invite_code: string } | null;

const MEMBER_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899'];

function getName(m: Member) {
  return m.full_name?.split(' ')[0] ?? m.email.split('@')[0] ?? 'User';
}

function avg(snaps: Snapshot[], key: keyof Snapshot) {
  const vals = snaps.map((s) => s[key] as number | null).filter((v): v is number => v !== null);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function fmtSleep(seconds: number) {
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
          {p.name}: <span className="font-semibold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

function MetricLeaderboard({
  label,
  icon,
  members,
  memberSnapshots,
  snapKey,
  unit,
  color,
  formatFn,
}: {
  label: string;
  icon: React.ReactNode;
  members: Member[];
  memberSnapshots: Record<string, Snapshot[]>;
  snapKey: keyof Snapshot;
  unit: string;
  color: string;
  formatFn?: (v: number) => string;
}) {
  const ranked = members
    .map((m) => ({ member: m, value: avg(memberSnapshots[m.id] ?? [], snapKey) }))
    .sort((a, b) => b.value - a.value);

  const max = ranked[0]?.value ?? 1;

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color }}>{icon}</span>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>7-day avg</span>
      </div>
      <div className="flex flex-col gap-3">
        {ranked.map(({ member, value }, i) => (
          <div key={member.id} className="flex items-center gap-3">
            <span className="text-sm w-4 font-mono" style={{ color: i === 0 ? '#f59e0b' : 'var(--text-muted)' }}>
              {i === 0 ? '1' : `${i + 1}`}
            </span>
            <span className="text-sm font-medium w-20 truncate" style={{ color: 'var(--text-secondary)' }}>
              {getName(member)}
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-elevated)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }}
              />
            </div>
            <span className="text-sm font-semibold w-16 text-right" style={{ color: 'var(--text-primary)' }}>
              {formatFn ? formatFn(value) : `${value.toLocaleString()} ${unit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupClient({
  userId,
  primaryGroup,
  members,
  memberSnapshots,
}: {
  userId: string;
  primaryGroup: Group;
  members: Member[];
  memberSnapshots: Record<string, Snapshot[]>;
}) {
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/group/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName }),
    });
    setLoading(false);
    if (res.ok) window.location.reload();
    else {
      const d = await res.json();
      setError(d.error ?? 'Failed to create group');
    }
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/group/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });
    setLoading(false);
    if (res.ok) window.location.reload();
    else {
      const d = await res.json();
      setError(d.error ?? 'Invalid invite code');
    }
  }

  function copyCode() {
    if (!primaryGroup) return;
    navigator.clipboard.writeText(primaryGroup.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)',
  };

  // No group yet
  if (!primaryGroup) {
    return (
      <div className="px-6 py-8 pb-24 lg:pb-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Group</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Compare health metrics with friends</p>
        </div>

        {!showCreate && !showJoin && (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-muted)' }}>
              <Users size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No group yet</p>
            <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Create a group to share and compare your health data with friends or your partner.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Plus size={16} />
                Create group
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                <ArrowRight size={16} />
                Join with code
              </button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create a group</h2>
            <form onSubmit={createGroup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Group name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Arthur & Sophie"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                />
              </div>
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--accent)', color: 'white' }}>
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showJoin && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Join a group</h2>
            <form onSubmit={joinGroup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Invite code</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono tracking-widest"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                />
              </div>
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--accent)', color: 'white' }}>
                  {loading ? 'Joining...' : 'Join'}
                </button>
                <button type="button" onClick={() => setShowJoin(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Group exists - show comparison
  const allDates = [...new Set(
    Object.values(memberSnapshots).flat().map((s) => s.date)
  )].sort();

  const stepsChartData = allDates.map((date) => {
    const entry: Record<string, string | number> = { date: fmtShortDate(date) };
    members.forEach((m) => {
      const snap = memberSnapshots[m.id]?.find((s) => s.date === date);
      entry[getName(m)] = snap?.steps ?? 0;
    });
    return entry;
  });

  const hrvChartData = allDates.map((date) => {
    const entry: Record<string, string | number> = { date: fmtShortDate(date) };
    members.forEach((m) => {
      const snap = memberSnapshots[m.id]?.find((s) => s.date === date);
      entry[getName(m)] = snap?.hrv_last_night ? Math.round(snap.hrv_last_night) : 0;
    });
    return entry;
  });

  // Radar chart data
  const radarData = [
    { metric: 'Steps', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, Math.round(avg(memberSnapshots[m.id] ?? [], 'steps') / 100))])) },
    { metric: 'Sleep', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, Math.round(avg(memberSnapshots[m.id] ?? [], 'sleep_seconds') / 3600 * 12.5))])) },
    { metric: 'HRV', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, avg(memberSnapshots[m.id] ?? [], 'hrv_last_night'))])) },
    { metric: 'Battery', ...Object.fromEntries(members.map((m) => [getName(m), avg(memberSnapshots[m.id] ?? [], 'body_battery_high')])) },
    { metric: 'Active', ...Object.fromEntries(members.map((m) => [getName(m), Math.min(100, Math.round(avg(memberSnapshots[m.id] ?? [], 'active_seconds') / 60))])) },
  ];

  return (
    <div className="px-6 py-8 pb-24 lg:pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{primaryGroup.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={copyCode}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
        >
          {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
          <span className="font-mono tracking-widest">{primaryGroup.invite_code}</span>
        </button>
      </div>

      {/* Members row */}
      <div className="flex gap-3 flex-wrap mb-8">
        {members.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
              {getName(m)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{getName(m)}</p>
              {m.garmin_display_name && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.garmin_display_name}</p>
              )}
            </div>
            {m.id === userId && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>you</span>
            )}
          </div>
        ))}
      </div>

      {/* Leaderboards */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} style={{ color: '#f59e0b' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>7-day leaderboards</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricLeaderboard label="Steps" icon={<Steps size={16} />} members={members} memberSnapshots={memberSnapshots} snapKey="steps" unit="steps" color="#6366f1" />
          <MetricLeaderboard label="Sleep" icon={<Moon size={16} />} members={members} memberSnapshots={memberSnapshots} snapKey="sleep_seconds" unit="" color="#818cf8" formatFn={(v) => fmtSleep(v)} />
          <MetricLeaderboard label="HRV" icon={<Heartbeat size={16} />} members={members} memberSnapshots={memberSnapshots} snapKey="hrv_last_night" unit="ms" color="#22c55e" />
          <MetricLeaderboard label="Body Battery" icon={<BatteryFull size={16} />} members={members} memberSnapshots={memberSnapshots} snapKey="body_battery_high" unit="" color="#f59e0b" />
          <MetricLeaderboard label="Active Time" icon={<Timer size={16} />} members={members} memberSnapshots={memberSnapshots} snapKey="active_seconds" unit="" color="#06b6d4" formatFn={(v) => `${Math.floor(v / 60)} min`} />
        </div>
      </div>

      {/* Radar chart */}
      {members.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Health radar - 7-day avg</p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                {members.map((m, i) => (
                  <Radar key={m.id} name={getName(m)} dataKey={getName(m)} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} fillOpacity={0.15} />
                ))}
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>HRV comparison</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={hrvChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {members.map((m, i) => (
                  <Line key={m.id} type="monotone" dataKey={getName(m)} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Steps comparison */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Steps comparison - 7 days</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stepsChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {members.map((m, i) => (
              <Line key={m.id} type="monotone" dataKey={getName(m)} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
