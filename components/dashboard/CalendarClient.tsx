'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CaretLeft, CaretRight, Plus, Trash, CheckCircle, X,
  PersonSimpleRun, Barbell, Heart, PersonSimpleTaiChi, Bicycle, Bed, DotsThree, Sparkle,
} from '@phosphor-icons/react';

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
};

const TYPE_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  run: { color: '#e8521c', icon: <PersonSimpleRun size={13} weight="bold" />, label: 'Run' },
  strength: { color: '#6366f1', icon: <Barbell size={13} weight="bold" />, label: 'Strength' },
  recovery: { color: '#16a34a', icon: <Heart size={13} weight="bold" />, label: 'Recovery' },
  mobility: { color: '#0891b2', icon: <PersonSimpleTaiChi size={13} weight="bold" />, label: 'Mobility' },
  cardio: { color: '#db2777', icon: <Bicycle size={13} weight="bold" />, label: 'Cardio' },
  rest: { color: '#64748b', icon: <Bed size={13} weight="bold" />, label: 'Rest' },
  other: { color: '#9899aa', icon: <DotsThree size={13} weight="bold" />, label: 'Other' },
};

function typeMeta(t: string | null) {
  return TYPE_META[t ?? 'other'] ?? TYPE_META.other!;
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayISO = iso(new Date());

const emptyForm = { id: '', date: '', title: '', type: 'run', duration_min: '', intensity: 'moderate', description: '' };

export default function CalendarClient() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = days[6]!;

  const load = useCallback(async () => {
    setLoading(true);
    const we = new Date(weekStart);
    we.setDate(weekStart.getDate() + 6);
    const res = await fetch(`/api/training?from=${iso(weekStart)}&to=${iso(we)}`);
    const data = await res.json();
    setSessions(data.sessions ?? []);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  function openAdd(date: string) {
    setForm({ ...emptyForm, date });
    setEditing(false);
    setModalOpen(true);
  }

  function openEdit(s: Session) {
    setForm({
      id: s.id, date: s.date, title: s.title, type: s.type ?? 'other',
      duration_min: s.duration_min?.toString() ?? '', intensity: s.intensity ?? 'moderate',
      description: s.description ?? '',
    });
    setEditing(true);
    setModalOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      date: form.date,
      title: form.title.trim(),
      type: form.type,
      duration_min: form.duration_min ? Number(form.duration_min) : null,
      intensity: form.intensity,
      description: form.description || null,
    };
    if (editing) {
      await fetch('/api/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: form.id, ...payload }) });
    } else {
      await fetch('/api/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    await fetch('/api/training', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setModalOpen(false);
  }

  async function toggleComplete(s: Session) {
    const next = s.status === 'completed' ? 'planned' : 'completed';
    setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, status: next } : x));
    await fetch('/api/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, status: next }) });
  }

  const monthLabel = (() => {
    const a = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const b = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    return a === b
      ? `${weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : `${a} – ${b} ${weekEnd.getFullYear()}`;
  })();

  const total = sessions.length;
  const done = sessions.filter((s) => s.status === 'completed').length;

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>Training calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            Plan your week. Your AI coach can build and adjust this for you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
              className="px-2.5 py-2 cursor-pointer transition-colors hover:opacity-70" style={{ color: 'var(--text-2)' }}>
              <CaretLeft size={15} weight="bold" />
            </button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 py-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-2)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
              Today
            </button>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
              className="px-2.5 py-2 cursor-pointer transition-colors hover:opacity-70" style={{ color: 'var(--text-2)' }}>
              <CaretRight size={15} weight="bold" />
            </button>
          </div>
          <button onClick={() => openAdd(todayISO >= iso(weekStart) && todayISO <= iso(weekEnd) ? todayISO : iso(weekStart))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}>
            <Plus size={15} weight="bold" /> <span className="hidden sm:inline">Add session</span>
          </button>
        </div>
      </div>

      {/* Sub-header: month + progress */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{monthLabel}</p>
        {total > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {done}/{total} sessions done this week
          </p>
        )}
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((d) => {
          const key = iso(d);
          const isToday = key === todayISO;
          const daySessions = sessions.filter((s) => s.date === key);
          return (
            <div key={key} className="rounded-2xl p-3 flex flex-col min-h-[150px]"
              style={{
                background: isToday ? 'color-mix(in srgb, var(--accent) 5%, var(--surface))' : 'var(--surface)',
                border: isToday ? '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))' : '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-sm font-bold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-1)' }}>
                    {d.getDate()}
                  </span>
                </div>
                <button onClick={() => openAdd(key)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
                  title="Add session">
                  <Plus size={12} weight="bold" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                {daySessions.map((s) => {
                  const m = typeMeta(s.type);
                  const completed = s.status === 'completed';
                  return (
                    <button key={s.id} onClick={() => openEdit(s)}
                      className="text-left rounded-xl p-2.5 cursor-pointer transition-all hover:opacity-90"
                      style={{
                        background: `color-mix(in srgb, ${m.color} ${completed ? 6 : 11}%, var(--surface))`,
                        border: `1px solid color-mix(in srgb, ${m.color} ${completed ? 18 : 32}%, transparent)`,
                        opacity: s.status === 'skipped' ? 0.5 : 1,
                      }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span style={{ color: m.color }}>{m.icon}</span>
                        <span className="text-xs font-semibold leading-tight flex-1" style={{ color: 'var(--text-1)', textDecoration: completed ? 'line-through' : 'none' }}>
                          {s.title}
                        </span>
                        {completed && <CheckCircle size={13} weight="fill" style={{ color: m.color }} />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {s.duration_min ? <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{s.duration_min}m</span> : null}
                        {s.intensity ? <span className="text-[10px] capitalize" style={{ color: 'var(--text-3)' }}>· {s.intensity}</span> : null}
                        {s.created_by === 'coach' && (
                          <span className="text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
                            <Sparkle size={8} weight="fill" /> coach
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {!loading && daySessions.length === 0 && (
                  <button onClick={() => openAdd(key)} className="flex-1 min-h-[40px] rounded-xl cursor-pointer transition-colors flex items-center justify-center"
                    style={{ border: '1px dashed var(--border-strong)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Rest / add</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Coach nudge */}
      {!loading && total === 0 && (
        <div className="mt-5 rounded-2xl p-5 flex items-center gap-3"
          style={{ background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
            <Sparkle size={18} weight="fill" color="#fff" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Let your coach plan the week</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
              Head to the AI Coach and ask it to build a training week. It reads your recovery and goals, and fills this calendar for you.
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>{editing ? 'Edit session' : 'New session'}</h3>
              <button onClick={() => setModalOpen(false)} className="cursor-pointer" style={{ color: 'var(--text-3)' }}><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-3.5">
              <Field label="Title">
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Tempo run, Upper body"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} autoFocus />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </Field>
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (min)">
                  <input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                    placeholder="45" className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </Field>
                <Field label="Intensity">
                  <select value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="hard">Hard</option>
                  </select>
                </Field>
              </div>

              <Field label="Notes">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Intervals, pace, sets/reps..." rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
              </Field>

              <div className="flex gap-2 mt-1">
                {editing && (
                  <>
                    <button onClick={() => remove(form.id)}
                      className="px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer flex items-center gap-1.5"
                      style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                      <Trash size={14} />
                    </button>
                    <button onClick={() => { const s = sessions.find((x) => x.id === form.id); if (s) { toggleComplete(s); setModalOpen(false); } }}
                      className="px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer flex items-center gap-1.5"
                      style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                      <CheckCircle size={14} /> Done
                    </button>
                  </>
                )}
                <button onClick={save} disabled={saving || !form.title.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to calendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-1)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  );
}
