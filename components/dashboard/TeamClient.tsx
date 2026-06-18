'use client';

import { useState } from 'react';
import {
  Barbell, Plus, ArrowRight, Copy, Check, Steps, Moon, Heartbeat, BatteryFull,
  UserCircle, SignOut, ChartLineUp, X,
} from '@phosphor-icons/react';

type Snapshot = {
  date: string;
  steps: number | null;
  sleep_seconds: number | null;
  hrv_last_night: number | null;
  body_battery_high: number | null;
  resting_hr: number | null;
  active_seconds: number | null;
};

export type RosterMember = {
  id: string;
  name: string;
  email: string;
  garminConnected: boolean;
  snapshots: Snapshot[];
};

export type RosterTeam = {
  id: string;
  name: string;
  joinCode: string;
  members: RosterMember[];
};

export type AthleteTeam = {
  id: string;
  name: string;
  coachName: string;
};

const AVATAR_COLORS = ['#e8521c', '#6366f1', '#16a34a', '#db2777', '#0891b2', '#d97706'];

function fmtSleep(seconds: number | null) {
  if (!seconds) return '--';
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function latest(snaps: Snapshot[]): Snapshot | null {
  return snaps.length ? snaps[snaps.length - 1]! : null;
}

function recovery(snaps: Snapshot[]): { label: string; color: string } {
  const t = latest(snaps);
  const bb = t?.body_battery_high ?? null;
  if (bb == null) return { label: 'No data', color: 'var(--text-3)' };
  if (bb >= 70) return { label: 'Fresh', color: 'var(--green)' };
  if (bb >= 45) return { label: 'Moderate', color: 'var(--amber)' };
  return { label: 'Fatigued', color: 'var(--red)' };
}

function Sparkline({ snaps }: { snaps: Snapshot[] }) {
  const vals = snaps.slice(-7).map((s) => s.steps ?? 0);
  const max = Math.max(1, ...vals);
  return (
    <div className="flex items-end gap-[3px] h-8">
      {vals.length === 0 && <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>No recent data</span>}
      {vals.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, (v / max) * 100)}%`, minWidth: 4, background: i === vals.length - 1 ? 'var(--accent)' : 'var(--border-strong)' }} />
      ))}
    </div>
  );
}

function AthleteCard({ member, index }: { member: RosterMember; index: number }) {
  const t = latest(member.snapshots);
  const rec = recovery(member.snapshots);
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]!;
  const lastDate = t ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: color }}>
          {member.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--text-1)' }}>{member.name}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
            {lastDate ? `Last data ${lastDate}` : 'No data yet'}
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ background: `color-mix(in srgb, ${rec.color} 14%, transparent)`, color: rec.color }}>
          {rec.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Metric icon={<Steps size={13} />} label="Steps" value={t?.steps?.toLocaleString() ?? '--'} color="#e8521c" />
        <Metric icon={<Moon size={13} />} label="Sleep" value={fmtSleep(t?.sleep_seconds ?? null)} color="#6366f1" />
        <Metric icon={<Heartbeat size={13} />} label="HRV" value={t?.hrv_last_night ? `${Math.round(t.hrv_last_night)} ms` : '--'} color="#16a34a" />
        <Metric icon={<BatteryFull size={13} />} label="Battery" value={t?.body_battery_high ? `${t.body_battery_high}` : '--'} color="#d97706" />
      </div>

      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[10px] uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
          <ChartLineUp size={11} /> 7-day steps
        </span>
        <div className="w-28"><Sparkline snaps={member.snapshots} /></div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-1 mb-0.5" style={{ color }}>{icon}<span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>{label}</span></div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{value}</p>
    </div>
  );
}

export default function TeamClient({ rosters, athleteTeams }: { rosters: RosterTeam[]; athleteTeams: AthleteTeam[] }) {
  const [mode, setMode] = useState<null | 'create' | 'join'>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const hasAnything = rosters.length > 0 || athleteTeams.length > 0;

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/team/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setLoading(false);
    if (res.ok) window.location.reload();
    else setError((await res.json()).error ?? 'Failed to create team');
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/team/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ joinCode: code }) });
    setLoading(false);
    if (res.ok) window.location.reload();
    else setError((await res.json()).error ?? 'Invalid join code');
  }

  async function leaveTeam(teamId: string) {
    await fetch('/api/team/join', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId }) });
    window.location.reload();
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c);
    setCopied(c);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>Team</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            Coach a team or training group. Track everyone&apos;s recovery and load in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMode('join'); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <ArrowRight size={15} /> Join
          </button>
          <button onClick={() => { setMode('create'); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            <Plus size={15} weight="bold" /> New team
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!hasAnything && mode === null && (
        <div className="rounded-2xl p-10 text-center max-w-lg mx-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Barbell size={28} weight="bold" />
          </div>
          <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-1)' }}>Coach a team, or join one</p>
          <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: 'var(--text-2)' }}>
            Personal trainers and clubs: create a team and share the code. Every athlete who joins shows up here with their live metrics. Athletes: enter your coach&apos;s code to share your data.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setMode('create')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus size={16} /> Create a team
            </button>
            <button onClick={() => setMode('join')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <ArrowRight size={16} /> Join with code
            </button>
          </div>
        </div>
      )}

      {/* Coach rosters */}
      {rosters.map((team) => (
        <div key={team.id} className="mb-8">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Barbell size={18} weight="bold" color="#fff" />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>{team.name}</h2>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{team.members.length} athlete{team.members.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => copyCode(team.joinCode)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }}>
              {copied === team.joinCode ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Copy size={14} />}
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Invite code</span>
              <span className="font-mono font-bold tracking-widest" style={{ color: 'var(--accent)' }}>{team.joinCode}</span>
            </button>
          </div>

          {team.members.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>No athletes yet</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Share code <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{team.joinCode}</span> so athletes can join and share their metrics.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {team.members.map((m, i) => <AthleteCard key={m.id} member={m} index={i} />)}
            </div>
          )}
        </div>
      ))}

      {/* Athlete memberships */}
      {athleteTeams.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <UserCircle size={16} /> Teams you train with
          </h2>
          <div className="flex flex-col gap-2.5">
            {athleteTeams.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-2xl px-5 py-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Coached by {t.coachName} · your metrics are shared with this team</p>
                </div>
                <button onClick={() => leaveTeam(t.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ color: 'var(--text-3)' }}>
                  <SignOut size={13} /> Leave
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Join modal */}
      {mode !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setMode(null); }}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{mode === 'create' ? 'Create a team' : 'Join a team'}</h3>
              <button onClick={() => setMode(null)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
            </div>
            <form onSubmit={mode === 'create' ? createTeam : joinTeam} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{mode === 'create' ? 'Team name' : 'Invite code'}</label>
                <input type="text"
                  value={mode === 'create' ? name : code}
                  onChange={(e) => mode === 'create' ? setName(e.target.value) : setCode(e.target.value.toUpperCase())}
                  placeholder={mode === 'create' ? 'e.g. Sunday Runners, Studio clients' : 'Enter 6-character code'}
                  required autoFocus
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }} />
              </div>
              {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {loading ? 'Working...' : mode === 'create' ? 'Create team' : 'Join team'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
