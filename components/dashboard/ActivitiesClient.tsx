'use client';

import { useState, useEffect } from 'react';
import { Pulse, MapPin, Timer, Flame, Heartbeat, ArrowsClockwise } from '@phosphor-icons/react';
import type { Activity as GarminActivity } from '@/lib/garmin/garmin-client';

type Profile = { garmin_connected: boolean; full_name: string | null; email: string } | null;

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatPace(metersPerSecond: number) {
  if (!metersPerSecond) return '--';
  const minPerKm = 1000 / metersPerSecond / 60;
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

const ACTIVITY_ICONS: Record<string, string> = {
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  hiking: '🥾',
  strength_training: '🏋️',
  yoga: '🧘',
  walking: '🚶',
};

export default function ActivitiesClient({ profile }: { profile: Profile }) {
  const [activities, setActivities] = useState<GarminActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchActivities() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/garmin/activities');
    const data = await res.json();
    setLoading(false);
    if (res.ok) setActivities(data.activities ?? []);
    else setError(data.error ?? 'Failed to load activities');
  }

  useEffect(() => {
    if (profile?.garmin_connected) fetchActivities();
  }, [profile?.garmin_connected]);

  return (
    <div className="px-6 py-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Activities</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your recent training sessions</p>
        </div>
        <button
          onClick={fetchActivities}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
        >
          <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {activities.length === 0 && !loading && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Pulse size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No activities loaded</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Click refresh to fetch your Garmin activities.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {activities.map((a) => {
          const typeKey = a.activityType?.typeKey ?? 'running';
          const emoji = ACTIVITY_ICONS[typeKey] ?? '🏅';
          return (
            <div
              key={a.activityId}
              className="rounded-2xl p-5 transition-all hover:border-opacity-30"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.activityName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(a.startTimeLocal).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}>
                  {typeKey.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {a.distance > 0 && (
                  <Stat icon={<MapPin size={13} />} label="Distance" value={`${(a.distance / 1000).toFixed(2)} km`} />
                )}
                <Stat icon={<Timer size={13} />} label="Duration" value={formatDuration(a.duration)} />
                {a.calories > 0 && (
                  <Stat icon={<Flame size={13} />} label="Calories" value={a.calories.toLocaleString()} />
                )}
                {a.averageHR > 0 && (
                  <Stat icon={<Heartbeat size={13} />} label="Avg HR" value={`${Math.round(a.averageHR)} bpm`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
