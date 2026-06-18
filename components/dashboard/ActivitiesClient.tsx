'use client';

import { useState, useEffect } from 'react';
import { ArrowsClockwise, MagnifyingGlass, Funnel, DotsThree } from '@phosphor-icons/react';
import type { Activity as GarminActivity } from '@/lib/garmin/garmin-client';
import { useI18n } from '@/lib/i18n/I18nProvider';

type Profile = { garmin_connected: boolean; full_name: string | null; email: string } | null;

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const TYPE_EMOJI: Record<string, string> = {
  running: '🏃', cycling: '🚴', swimming: '🏊', hiking: '🥾',
  strength_training: '🏋️', yoga: '🧘', walking: '🚶', trail_running: '🏔️',
};

const TYPE_LABEL_KEY: Record<string, string> = {
  running: 'running', cycling: 'cycling', swimming: 'swimming',
  hiking: 'hiking', strength_training: 'strength', yoga: 'yoga',
  walking: 'walking', trail_running: 'trailRun',
};

function fmtDate(dateStr: string, localeTag: string) {
  return new Date(dateStr).toLocaleDateString(localeTag, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivitiesClient({ profile }: { profile: Profile }) {
  const { t, localeTag } = useI18n();
  const typeLabel = (typeKey: string) =>
    TYPE_LABEL_KEY[typeKey] ? t(`activities.type.${TYPE_LABEL_KEY[typeKey]}`) : '';
  const [activities, setActivities] = useState<GarminActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function fetchActivities() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/garmin/activities');
    const data = await res.json();
    setLoading(false);
    if (res.ok) setActivities(data.activities ?? []);
    else setError(data.error ?? t('activities.loadError'));
  }

  useEffect(() => {
    if (profile?.garmin_connected) fetchActivities();
  }, [profile?.garmin_connected]);

  const filtered = activities.filter((a) =>
    a.activityName.toLowerCase().includes(search.toLowerCase()) ||
    typeLabel(a.activityType?.typeKey).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{t('nav.activities')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{t('activities.subtitle')}</p>
        </div>
        <button onClick={fetchActivities} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }}>
          <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>

        {/* Table toolbar */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
            {t('activities.recent')}
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>
              {t('activities.sessions', { count: filtered.length })}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <MagnifyingGlass size={14} style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="text-sm outline-none w-36 bg-transparent"
                style={{ color: 'var(--text-1)' }}
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm cursor-pointer"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <Funnel size={14} />
              {t('common.filter')}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {/* Table head */}
        <div className="grid grid-cols-12 px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>
          <div className="col-span-1" />
          <div className="col-span-3">{t('activities.colActivity')}</div>
          <div className="col-span-2 text-right">{t('metrics.distance')}</div>
          <div className="col-span-2 text-right">{t('activities.colDuration')}</div>
          <div className="col-span-2 text-right">{t('metrics.calories')}</div>
          <div className="col-span-2 text-right">{t('activities.colDate')}</div>
        </div>

        {/* Table rows */}
        {filtered.length === 0 && !loading ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
              {search ? t('activities.emptyMatch') : t('activities.emptyNone')}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              {!search && t('activities.emptyHint')}
            </p>
          </div>
        ) : (
          filtered.map((a, i) => {
            const typeKey = a.activityType?.typeKey ?? 'running';
            const emoji = TYPE_EMOJI[typeKey] ?? '🏅';
            const label = TYPE_LABEL_KEY[typeKey] ? typeLabel(typeKey) : typeKey.replace('_', ' ');

            return (
              <div key={a.activityId}
                className="grid grid-cols-12 items-center px-5 py-3.5 transition-colors"
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'default',
                }}>
                {/* Type badge */}
                <div className="col-span-1">
                  <span className="text-lg leading-none">{emoji}</span>
                </div>

                {/* Name + type */}
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                    {a.activityName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</p>
                </div>

                {/* Distance */}
                <div className="col-span-2 text-right">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    {a.distance > 0 ? `${(a.distance / 1000).toFixed(2)} km` : '--'}
                  </span>
                </div>

                {/* Duration */}
                <div className="col-span-2 text-right">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    {formatDuration(a.duration)}
                  </span>
                </div>

                {/* Calories */}
                <div className="col-span-2 text-right">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    {a.calories > 0 ? a.calories.toLocaleString(localeTag) : '--'}
                  </span>
                </div>

                {/* Date */}
                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {fmtDate(a.startTimeLocal, localeTag)}
                  </span>
                  <button className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-3)' }}>
                    <DotsThree size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
