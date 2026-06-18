'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CaretLeft, CaretRight, Plus, Trash, CheckCircle, X, Play, Check,
  PersonSimpleRun, Barbell, Heart, PersonSimpleTaiChi, Bicycle, Bed, DotsThree, Sparkle, PencilSimple, Fire, Clock,
} from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { TFunction } from '@/lib/i18n/translate';
import { estimateCalories } from '@/lib/training/calories';

type SetEntry = { weight: string; reps: string; done: boolean };
type Exercise = { name: string; sets: SetEntry[] };
type Session = {
  id: string;
  date: string;
  title: string;
  type: string | null;
  description: string | null;
  duration_min: number | null;
  intensity: string | null;
  status: string;
  created_by: string;
  exercises: Exercise[];
  rpe: number | null;
  distance_meters: number | null;
  start_time: string | null;
  feel: string | null;
  calories: number | null;
  calories_estimated: boolean;
};

const TYPE_META: Record<string, { color: string; icon: React.ReactNode; labelKey: string }> = {
  run: { color: '#e8521c', icon: <PersonSimpleRun size={13} weight="bold" />, labelKey: 'calendar.typeRun' },
  strength: { color: '#6366f1', icon: <Barbell size={13} weight="bold" />, labelKey: 'calendar.typeStrength' },
  recovery: { color: '#16a34a', icon: <Heart size={13} weight="bold" />, labelKey: 'calendar.typeRecovery' },
  mobility: { color: '#0891b2', icon: <PersonSimpleTaiChi size={13} weight="bold" />, labelKey: 'calendar.typeMobility' },
  cardio: { color: '#db2777', icon: <Bicycle size={13} weight="bold" />, labelKey: 'calendar.typeCardio' },
  rest: { color: '#64748b', icon: <Bed size={13} weight="bold" />, labelKey: 'calendar.typeRest' },
  other: { color: '#9899aa', icon: <DotsThree size={13} weight="bold" />, labelKey: 'calendar.typeOther' },
};
function typeMeta(t: string | null) { return TYPE_META[t ?? 'other'] ?? TYPE_META.other!; }
function typeLabel(t: TFunction, type: string | null) { return t(typeMeta(type).labelKey); }

const INTENSITIES = [
  { value: 'easy', key: 'calendar.intensityEasy' },
  { value: 'moderate', key: 'calendar.intensityModerate' },
  { value: 'hard', key: 'calendar.intensityHard' },
];
function intensityLabel(t: TFunction, v: string | null) {
  const m = INTENSITIES.find((i) => i.value === v);
  return m ? t(m.key) : v ?? '';
}

const FEELS = [
  { value: 'great', key: 'calendar.feelGreat' },
  { value: 'good', key: 'calendar.feelGood' },
  { value: 'ok', key: 'calendar.feelOk' },
  { value: 'tired', key: 'calendar.feelTired' },
  { value: 'rough', key: 'calendar.feelRough' },
];

// Cardio-type workouts where a distance field is meaningful.
const DISTANCE_TYPES = new Set(['run', 'cardio']);

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}
function normalize(raw: Record<string, unknown>): Session {
  const ex = Array.isArray(raw.exercises) ? (raw.exercises as Exercise[]) : [];
  return {
    ...(raw as unknown as Session),
    exercises: ex,
    rpe: (raw.rpe as number) ?? null,
    distance_meters: (raw.distance_meters as number) ?? null,
    start_time: (raw.start_time as string) ?? null,
    feel: (raw.feel as string) ?? null,
    calories: (raw.calories as number) ?? null,
    calories_estimated: Boolean(raw.calories_estimated),
  };
}
const todayISO = iso(new Date());

export default function CalendarClient({ weightKg }: { weightKg: number | null }) {
  const { t, localeTag } = useI18n();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [dayPanel, setDayPanel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Session | null>(null);
  const [editor, setEditor] = useState<{ session: Session | null; date: string } | null>(null);
  const [workout, setWorkout] = useState<Session | null>(null);

  const gridStart = (() => {
    if (view === 'week') return startOfWeek(cursor);
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return startOfWeek(first);
  })();
  const dayCount = view === 'week' ? 7 : 42;
  const days = Array.from({ length: dayCount }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  const rangeEnd = days[days.length - 1]!;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/training?from=${iso(gridStart)}&to=${iso(rangeEnd)}`);
    const data = await res.json();
    setSessions((data.sessions ?? []).map(normalize));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso(gridStart), iso(rangeEnd)]);
  useEffect(() => { load(); }, [load]);

  function shift(dir: number) {
    const d = new Date(cursor);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  }

  const byDay = (key: string) => sessions.filter((s) => s.date === key);

  const title = view === 'week'
    ? `${gridStart.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })}`
    : cursor.toLocaleDateString(localeTag, { month: 'long', year: 'numeric' });

  // Localized Monday-first weekday initials for the month header.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = startOfWeek(new Date(2024, 0, 1)); d.setDate(d.getDate() + i);
    return d.toLocaleDateString(localeTag, { weekday: 'short' });
  });

  async function afterMutate() { await load(); }

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{t('calendar.title')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{t('calendar.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['month', 'week'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-2 text-xs font-semibold cursor-pointer"
                style={v === view ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-2)' }}>
                {t(`calendar.${v}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <button onClick={() => shift(-1)} className="px-2.5 py-2 cursor-pointer hover:opacity-70" style={{ color: 'var(--text-2)' }}><CaretLeft size={15} weight="bold" /></button>
            <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); }} className="px-3 py-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-2)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>{t('common.today')}</button>
            <button onClick={() => shift(1)} className="px-2.5 py-2 cursor-pointer hover:opacity-70" style={{ color: 'var(--text-2)' }}><CaretRight size={15} weight="bold" /></button>
          </div>
          <button onClick={() => setEditor({ session: null, date: todayISO >= iso(gridStart) && todayISO <= iso(rangeEnd) ? todayISO : iso(gridStart) })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            <Plus size={15} weight="bold" /> <span className="hidden sm:inline">{t('calendar.add')}</span>
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>{title}</p>

      {/* Weekday header (month) */}
      {view === 'month' && (
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {weekdayLabels.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold uppercase tracking-wide py-1" style={{ color: 'var(--text-3)' }}>{d}</div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className={view === 'month' ? 'grid grid-cols-7 gap-1.5' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3'}>
        {days.map((d) => {
          const key = iso(d);
          const isToday = key === todayISO;
          const inMonth = view === 'week' || d.getMonth() === cursor.getMonth();
          const dayS = byDay(key);
          if (view === 'month') {
            return (
              <button key={key} onClick={() => setDayPanel(key)}
                className="rounded-xl p-1.5 min-h-[78px] sm:min-h-[96px] flex flex-col text-left cursor-pointer transition-colors"
                style={{
                  background: isToday ? 'color-mix(in srgb, var(--accent) 7%, var(--surface))' : 'var(--surface)',
                  border: isToday ? '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))' : '1px solid var(--border)',
                  opacity: inMonth ? 1 : 0.45,
                }}>
                <span className="text-xs font-bold mb-1 px-0.5" style={{ color: isToday ? 'var(--accent)' : 'var(--text-2)' }}>{d.getDate()}</span>
                <div className="flex flex-col gap-1 flex-1">
                  {dayS.slice(0, 2).map((s) => {
                    const m = typeMeta(s.type);
                    return (
                      <div key={s.id} className="rounded-md px-1 py-0.5 flex items-center gap-1"
                        style={{ background: `color-mix(in srgb, ${m.color} 14%, transparent)`, opacity: s.status === 'completed' ? 0.6 : 1 }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                        <span className="text-[10px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{s.title}</span>
                      </div>
                    );
                  })}
                  {dayS.length > 2 && <span className="text-[10px] px-1" style={{ color: 'var(--text-3)' }}>{t('calendar.moreCount', { count: dayS.length - 2 })}</span>}
                </div>
              </button>
            );
          }
          return (
            <div key={key} className="rounded-2xl p-3 flex flex-col min-h-[150px]"
              style={{ background: isToday ? 'color-mix(in srgb, var(--accent) 5%, var(--surface))' : 'var(--surface)', border: isToday ? '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))' : '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>{d.toLocaleDateString(localeTag, { weekday: 'short' })}</span>
                  <span className="text-sm font-bold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-1)' }}>{d.getDate()}</span>
                </div>
                <button onClick={() => setEditor({ session: null, date: key })} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}><Plus size={12} weight="bold" /></button>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                {dayS.map((s) => <SessionChip key={s.id} s={s} onClick={() => setDetail(s)} />)}
                {!loading && dayS.length === 0 && (
                  <button onClick={() => setEditor({ session: null, date: key })} className="flex-1 min-h-[40px] rounded-xl cursor-pointer flex items-center justify-center" style={{ border: '1px dashed var(--border-strong)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t('calendar.restOrAdd')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Coach nudge */}
      {!loading && sessions.length === 0 && (
        <div className="mt-5 rounded-2xl p-5 flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}><Sparkle size={18} weight="fill" color="#fff" /></div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('calendar.coachNudgeTitle')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{t('calendar.coachNudgeBody')}</p>
          </div>
        </div>
      )}

      {/* Day panel */}
      {dayPanel && (
        <Modal onClose={() => setDayPanel(null)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
              {new Date(dayPanel + 'T00:00:00').toLocaleDateString(localeTag, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <button onClick={() => setDayPanel(null)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {byDay(dayPanel).length === 0 && <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('calendar.nothingPlanned')}</p>}
            {byDay(dayPanel).map((s) => <SessionChip key={s.id} s={s} expanded onClick={() => { setDayPanel(null); setDetail(s); }} />)}
          </div>
          <button onClick={() => { const d = dayPanel; setDayPanel(null); setEditor({ session: null, date: d }); }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--accent)', color: '#fff' }}>
            <Plus size={14} className="inline mr-1" /> {t('calendar.addWorkout')}
          </button>
        </Modal>
      )}

      {/* Session detail */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <SessionDetail
            s={detail}
            onClose={() => setDetail(null)}
            onEdit={() => { const s = detail; setDetail(null); setEditor({ session: s, date: s.date }); }}
            onStart={() => { const s = detail; setDetail(null); setWorkout(s); }}
            onDelete={async () => { await fetch('/api/training', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: detail.id }) }); setDetail(null); afterMutate(); }}
            onToggleComplete={async () => {
              const next = detail.status === 'completed' ? 'planned' : 'completed';
              await fetch('/api/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: detail.id, status: next }) });
              setDetail(null); afterMutate();
            }}
          />
        </Modal>
      )}

      {/* Editor */}
      {editor && (
        <Modal onClose={() => setEditor(null)}>
          <SessionEditor editor={editor} weightKg={weightKg} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); afterMutate(); }} />
        </Modal>
      )}

      {/* Workout logging */}
      {workout && (
        <WorkoutLogger session={workout} onClose={() => setWorkout(null)} onFinished={() => { setWorkout(null); afterMutate(); }} />
      )}
    </div>
  );
}

function SessionChip({ s, onClick, expanded }: { s: Session; onClick: () => void; expanded?: boolean }) {
  const { t } = useI18n();
  const m = typeMeta(s.type);
  const completed = s.status === 'completed';
  const bits = [typeLabel(t, s.type), s.duration_min ? `${s.duration_min} min` : null, intensityLabel(t, s.intensity)].filter(Boolean).join(' · ');
  return (
    <button onClick={onClick} className="text-left rounded-xl p-2.5 cursor-pointer transition-all hover:opacity-90 w-full"
      style={{ background: `color-mix(in srgb, ${m.color} ${completed ? 6 : 11}%, var(--surface))`, border: `1px solid color-mix(in srgb, ${m.color} ${completed ? 18 : 32}%, transparent)`, opacity: s.status === 'skipped' ? 0.5 : 1 }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color: m.color }}>{m.icon}</span>
        <span className="text-xs font-semibold leading-tight flex-1 truncate" style={{ color: 'var(--text-1)', textDecoration: completed ? 'line-through' : 'none' }}>{s.title}</span>
        {completed && <CheckCircle size={13} weight="fill" style={{ color: m.color }} />}
        {s.created_by === 'coach' && <Sparkle size={10} weight="fill" style={{ color: 'var(--accent)' }} />}
      </div>
      {bits && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{bits}</p>}
      {expanded && s.exercises.length > 0 && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{t('calendar.exercisesCount', { count: s.exercises.length })}</p>}
    </button>
  );
}

function SessionDetail({ s, onClose, onEdit, onStart, onDelete, onToggleComplete }: {
  s: Session; onClose: () => void; onEdit: () => void; onStart: () => void; onDelete: () => void; onToggleComplete: () => void;
}) {
  const { t } = useI18n();
  const m = typeMeta(s.type);
  const meta = [typeLabel(t, s.type), s.duration_min ? `${s.duration_min} min` : null, intensityLabel(t, s.intensity)].filter(Boolean).join(' · ');
  const distanceKm = s.distance_meters != null ? (s.distance_meters / 1000) : null;
  const stats = [
    s.calories != null ? { icon: <Fire size={13} weight="fill" />, text: `${s.calories} kcal${s.calories_estimated ? ' ≈' : ''}` } : null,
    distanceKm != null ? { icon: <PersonSimpleRun size={13} weight="bold" />, text: `${distanceKm} km` } : null,
    s.rpe != null ? { icon: null, text: `RPE ${s.rpe}` } : null,
    s.start_time ? { icon: <Clock size={13} weight="bold" />, text: s.start_time.slice(0, 5) } : null,
    s.feel ? { icon: null, text: t(`calendar.feel${s.feel.charAt(0).toUpperCase() + s.feel.slice(1)}`) } : null,
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];
  return (
    <>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${m.color} 15%, transparent)`, color: m.color }}>{m.icon}</div>
          <div>
            <h3 className="text-base font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>{s.title}</h3>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{meta}</p>
          </div>
        </div>
        <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
      </div>

      {stats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {stats.map((st, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
              {st.icon}{st.text}
            </span>
          ))}
        </div>
      )}

      {s.description && <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.description}</p>}

      {s.exercises.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('calendar.routine')}</p>
          {s.exercises.map((ex, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-1)' }}>{ex.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {ex.sets.map((set, j) => (
                  <span key={j} className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {set.weight ? `${set.weight}kg` : ''}{set.weight && set.reps ? ' × ' : ''}{set.reps ? `${set.reps}` : ''}{!set.weight && !set.reps ? `${t('calendar.setN', { n: j + 1 })}` : ''}
                    {set.done && <Check size={10} className="inline ml-1" style={{ color: 'var(--green)' }} />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button onClick={onDelete} className="px-3 py-2.5 rounded-xl cursor-pointer" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}><Trash size={14} /></button>
        <button onClick={onEdit} className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-sm font-medium" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}><PencilSimple size={14} /> {t('common.edit')}</button>
        <button onClick={onToggleComplete} className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 text-sm font-medium" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}><CheckCircle size={14} /> {s.status === 'completed' ? t('common.undo') : t('common.done')}</button>
        <button onClick={onStart} className="flex-1 py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 text-sm font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}><Play size={14} weight="fill" /> {t('calendar.startWorkout')}</button>
      </div>
    </>
  );
}

const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' };

function SessionEditor({ editor, weightKg, onClose, onSaved }: { editor: { session: Session | null; date: string }; weightKg: number | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const s = editor.session;
  const [title, setTitle] = useState(s?.title ?? '');
  const [date, setDate] = useState(s?.date ?? editor.date);
  const [type, setType] = useState(s?.type ?? 'strength');
  const [duration, setDuration] = useState(s?.duration_min?.toString() ?? '');
  const [intensity, setIntensity] = useState(s?.intensity ?? 'moderate');
  const [description, setDescription] = useState(s?.description ?? '');
  const [exercises, setExercises] = useState<Exercise[]>(s?.exercises ?? []);
  const [startTime, setStartTime] = useState(s?.start_time?.slice(0, 5) ?? '');
  const [distance, setDistance] = useState(s?.distance_meters != null ? String(s.distance_meters / 1000) : '');
  const [rpe, setRpe] = useState<string>(s?.rpe != null ? String(s.rpe) : '');
  const [feel, setFeel] = useState(s?.feel ?? '');
  // Only prefill the calories field when the user had entered it manually.
  const [calories, setCalories] = useState(s && !s.calories_estimated && s.calories != null ? String(s.calories) : '');
  const [saving, setSaving] = useState(false);

  const estimate = estimateCalories({ type, intensity, durationMin: duration ? Number(duration) : null, weightKg });
  const showDistance = DISTANCE_TYPES.has(type);

  function addExercise() { setExercises((p) => [...p, { name: '', sets: [{ weight: '', reps: '', done: false }] }]); }
  function setExName(i: number, name: string) { setExercises((p) => p.map((e, idx) => idx === i ? { ...e, name } : e)); }
  function removeExercise(i: number) { setExercises((p) => p.filter((_, idx) => idx !== i)); }
  function addSet(i: number) { setExercises((p) => p.map((e, idx) => idx === i ? { ...e, sets: [...e.sets, { weight: '', reps: '', done: false }] } : e)); }
  function setSetVal(i: number, j: number, k: 'weight' | 'reps', v: string) {
    setExercises((p) => p.map((e, idx) => idx === i ? { ...e, sets: e.sets.map((st, sj) => sj === j ? { ...st, [k]: v } : st) } : e));
  }
  function removeSet(i: number, j: number) { setExercises((p) => p.map((e, idx) => idx === i ? { ...e, sets: e.sets.filter((_, sj) => sj !== j) } : e)); }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      date, title: title.trim(), type, intensity, description: description || null,
      duration_min: duration ? Number(duration) : null,
      start_time: startTime || null,
      distance_km: showDistance && distance ? Number(distance) : null,
      rpe: rpe ? Number(rpe) : null,
      feel: feel || null,
      calories: calories === '' ? null : Number(calories),
      exercises: exercises.filter((e) => e.name.trim()),
    };
    if (s) await fetch('/api/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, ...payload }) });
    else await fetch('/api/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    onSaved();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{s ? t('calendar.editSession') : t('calendar.newSession')}</h3>
        <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
      </div>

      <div className="flex flex-col gap-3.5">
        <Field label={t('calendar.fieldTitle')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('calendar.titlePlaceholder')} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calendar.fieldDate')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} /></Field>
          <Field label={t('calendar.fieldTime')}><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calendar.fieldType')}><select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>{Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{t(v.labelKey)}</option>)}</select></Field>
          <Field label={t('calendar.fieldIntensity')}><select value={intensity} onChange={(e) => setIntensity(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>{INTENSITIES.map((i) => <option key={i.value} value={i.value}>{t(i.key)}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calendar.fieldDuration')}><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t('calendar.durationPlaceholder')} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} /></Field>
          {showDistance && (
            <Field label={t('calendar.fieldDistance')}><input type="number" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder={t('calendar.distancePlaceholder')} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} /></Field>
          )}
        </div>

        {/* Perceived effort */}
        <Field label={t('calendar.fieldRpe')}>
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={10} step={1} value={rpe || 5} onChange={(e) => setRpe(e.target.value)} className="flex-1 cursor-pointer accent-[var(--accent)]" />
            <span className="text-sm font-bold w-10 text-center" style={{ color: rpe ? 'var(--accent)' : 'var(--text-3)' }}>{rpe || '–'}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t('calendar.rpeHint')}</p>
        </Field>

        {/* How did you feel */}
        <Field label={t('calendar.fieldFeel')}>
          <div className="flex flex-wrap gap-1.5">
            {FEELS.map((f) => {
              const active = feel === f.value;
              return (
                <button key={f.value} type="button" onClick={() => setFeel(active ? '' : f.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={active ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  {t(f.key)}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Calories — optional, auto-estimated */}
        <Field label={t('calendar.fieldCalories')}>
          <input type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)}
            placeholder={estimate != null ? String(estimate) : ''}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          {weightKg == null ? (
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t('calendar.caloriesNeedWeight')}</p>
          ) : estimate != null ? (
            <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <Fire size={11} weight="fill" style={{ color: 'var(--accent)' }} />
              {t('calendar.caloriesEstimate', { value: estimate })} · {t('calendar.caloriesEstimateHint')}
            </p>
          ) : null}
        </Field>

        <Field label={t('calendar.fieldNotes')}><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('calendar.notesPlaceholder')} rows={2} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} /></Field>

        {/* Exercises */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{t('calendar.exercisesOptional')}</label>
            <button onClick={addExercise} className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: 'var(--accent)' }}><Plus size={12} weight="bold" /> {t('common.add')}</button>
          </div>
          {exercises.map((ex, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <input value={ex.name} onChange={(e) => setExName(i, e.target.value)} placeholder={t('calendar.exerciseNamePlaceholder')} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                <button onClick={() => removeExercise(i)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><Trash size={14} /></button>
              </div>
              <div className="flex flex-col gap-1.5">
                {ex.sets.map((st, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="text-xs w-8" style={{ color: 'var(--text-3)' }}>{t('calendar.setN', { n: j + 1 })}</span>
                    <input type="number" value={st.weight} onChange={(e) => setSetVal(i, j, 'weight', e.target.value)} placeholder={t('calendar.kg')} className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>×</span>
                    <input type="number" value={st.reps} onChange={(e) => setSetVal(i, j, 'reps', e.target.value)} placeholder={t('calendar.reps')} className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />
                    <button onClick={() => removeSet(i, j)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={13} /></button>
                  </div>
                ))}
                <button onClick={() => addSet(i)} className="text-xs font-medium self-start cursor-pointer mt-0.5" style={{ color: 'var(--accent)' }}>{t('calendar.addSet')}</button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving || !title.trim()} className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40 mt-1" style={{ background: 'var(--accent)', color: '#fff' }}>
          {saving ? t('common.saving') : s ? t('calendar.saveChanges') : t('calendar.addToCalendar')}
        </button>
      </div>
    </>
  );
}

// Hevy-style live logging — full screen
function WorkoutLogger({ session, onClose, onFinished }: { session: Session; onClose: () => void; onFinished: () => void }) {
  const { t } = useI18n();
  const [exercises, setExercises] = useState<Exercise[]>(
    session.exercises.length ? session.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })) : [{ name: session.title, sets: [{ weight: '', reps: '', done: false }] }],
  );
  const [rpe, setRpe] = useState<string>(session.rpe != null ? String(session.rpe) : '');
  const [feel, setFeel] = useState(session.feel ?? '');
  const [saving, setSaving] = useState(false);

  function toggle(i: number, j: number) { setExercises((p) => p.map((e, idx) => idx === i ? { ...e, sets: e.sets.map((st, sj) => sj === j ? { ...st, done: !st.done } : st) } : e)); }
  function setVal(i: number, j: number, k: 'weight' | 'reps', v: string) { setExercises((p) => p.map((e, idx) => idx === i ? { ...e, sets: e.sets.map((st, sj) => sj === j ? { ...st, [k]: v } : st) } : e)); }
  function addSet(i: number) {
    setExercises((p) => p.map((e, idx) => {
      if (idx !== i) return e;
      const last = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { weight: last?.weight ?? '', reps: last?.reps ?? '', done: false }] };
    }));
  }
  function addExercise() { setExercises((p) => [...p, { name: '', sets: [{ weight: '', reps: '', done: false }] }]); }
  function setName(i: number, name: string) { setExercises((p) => p.map((e, idx) => idx === i ? { ...e, name } : e)); }

  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);

  async function finish() {
    setSaving(true);
    await fetch('/api/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: session.id, exercises: exercises.filter((e) => e.name.trim()), status: 'completed', rpe: rpe ? Number(rpe) : null, feel: feel || null }) });
    setSaving(false);
    onFinished();
  }
  async function saveProgress() {
    setSaving(true);
    await fetch('/api/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: session.id, exercises: exercises.filter((e) => e.name.trim()), rpe: rpe ? Number(rpe) : null, feel: feel || null }) });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={saveProgress} className="text-sm font-medium cursor-pointer" style={{ color: 'var(--text-3)' }}>{t('calendar.saveAndClose')}</button>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{session.title}</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{t('calendar.setsDone', { done: doneSets, total: totalSets })}</p>
        </div>
        <button onClick={finish} disabled={saving} className="text-sm font-bold cursor-pointer disabled:opacity-50" style={{ color: 'var(--accent)' }}>{t('calendar.finish')}</button>
      </div>

      {/* Progress bar */}
      <div className="h-1 flex-shrink-0" style={{ background: 'var(--border)' }}>
        <div className="h-full transition-all" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`, background: 'var(--accent)' }} />
      </div>

      {/* Exercises */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-4">
          {exercises.map((ex, i) => (
            <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <input value={ex.name} onChange={(e) => setName(i, e.target.value)} placeholder={t('calendar.exerciseNamePlaceholder')}
                className="text-base font-semibold mb-3 w-full outline-none bg-transparent" style={{ color: 'var(--text-1)' }} />
              <div className="grid grid-cols-[28px_1fr_1fr_40px] gap-2 items-center mb-1.5 px-1">
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-3)' }}>{t('calendar.setHeader')}</span>
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-3)' }}>{t('calendar.kg')}</span>
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-3)' }}>{t('calendar.repsHeader')}</span>
                <span />
              </div>
              <div className="flex flex-col gap-1.5">
                {ex.sets.map((st, j) => (
                  <div key={j} className="grid grid-cols-[28px_1fr_1fr_40px] gap-2 items-center rounded-lg p-1"
                    style={{ background: st.done ? 'var(--green-bg)' : 'transparent' }}>
                    <span className="text-sm font-semibold text-center" style={{ color: 'var(--text-2)' }}>{j + 1}</span>
                    <input type="number" inputMode="decimal" value={st.weight} onChange={(e) => setVal(i, j, 'weight', e.target.value)} placeholder="0" className="px-2.5 py-2 rounded-lg text-sm outline-none text-center" style={inputStyle} />
                    <input type="number" inputMode="numeric" value={st.reps} onChange={(e) => setVal(i, j, 'reps', e.target.value)} placeholder="0" className="px-2.5 py-2 rounded-lg text-sm outline-none text-center" style={inputStyle} />
                    <button onClick={() => toggle(i, j)} className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer mx-auto"
                      style={{ background: st.done ? 'var(--green)' : 'var(--surface-2)', border: st.done ? 'none' : '1px solid var(--border-strong)' }}>
                      <Check size={15} weight="bold" color={st.done ? '#fff' : 'var(--text-3)'} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addSet(i)} className="w-full mt-2 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{t('calendar.addSet')}</button>
            </div>
          ))}
          <button onClick={addExercise} className="py-3 rounded-2xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', color: 'var(--text-2)' }}>{t('calendar.addExercise')}</button>

          {/* Effort & feel — captured when you finish */}
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{t('calendar.fieldRpe')}</label>
              <div className="flex items-center gap-3 mt-1">
                <input type="range" min={1} max={10} step={1} value={rpe || 5} onChange={(e) => setRpe(e.target.value)} className="flex-1 cursor-pointer accent-[var(--accent)]" />
                <span className="text-sm font-bold w-10 text-center" style={{ color: rpe ? 'var(--accent)' : 'var(--text-3)' }}>{rpe || '–'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{t('calendar.fieldFeel')}</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {FEELS.map((f) => {
                  const active = feel === f.value;
                  return (
                    <button key={f.value} type="button" onClick={() => setFeel(active ? '' : f.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      style={active ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      {t(f.key)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  );
}
