'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PaperPlaneTilt, Robot, User, Plus, Target, CheckCircle, Trash, CaretDown, ArrowCounterClockwise, Bandaids, CalendarCheck, X } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';

type Injury = {
  id: string;
  body_part: string;
  description: string | null;
  severity: string;
  status: string;
  started_on: string | null;
};

type Snapshot = Record<string, unknown>;
type Objective = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
};

type Message = { role: 'user' | 'assistant'; content: string };

function MarkdownMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) return <span>{content}</span>;

  // Parse markdown into paragraphs with inline bold/italic
  const paragraphs = content.split(/\n{2,}/);

  function renderInline(text: string) {
    // Bold: **text** or __text__
    // Italic: *text* or _text_
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    const pattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match[1]) {
        parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
      } else {
        parts.push(<em key={key++}>{match[4]}</em>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    return parts.length > 0 ? parts : text;
  }

  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Bullet list
        const lines = trimmed.split('\n');
        const isList = lines.every(l => /^[-*•]\s/.test(l.trim()));
        if (isList) {
          return (
            <ul key={i} className="flex flex-col gap-1.5 pl-1">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                  <span>{renderInline(line.replace(/^[-*•]\s/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Heading (### or ##)
        if (/^#{1,3}\s/.test(trimmed)) {
          return (
            <p key={i} className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              {renderInline(trimmed.replace(/^#{1,3}\s/, ''))}
            </p>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

const PRESET_OBJECTIVE_KEYS = [
  'hyrox',
  'marathon',
  'halfMarathon',
  'sub20_5k',
  'sub45_10k',
  'triathlon',
  'improveHrv',
  'loseWeight',
  'buildStrength',
  'ultraTrail',
];

function fmtSleep(seconds: number | null) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function CoachClient({ snapshots, objectives: initialObjectives }: {
  snapshots: Snapshot[];
  objectives: Objective[];
}) {
  const { t, localeTag } = useI18n();
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('coach-messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [addingObjective, setAddingObjective] = useState(false);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryPart, setInjuryPart] = useState('');
  const [injurySeverity, setInjurySeverity] = useState('moderate');
  const [calendarUpdated, setCalendarUpdated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadInjuries = useCallback(async () => {
    try {
      const res = await fetch('/api/injuries');
      const data = await res.json();
      setInjuries((data.injuries ?? []).filter((i: Injury) => i.status === 'active'));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadInjuries(); }, [loadInjuries]);

  async function addInjury() {
    if (!injuryPart.trim()) return;
    const res = await fetch('/api/injuries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body_part: injuryPart.trim(), severity: injurySeverity }),
    });
    const data = await res.json();
    if (data.injury) setInjuries((prev) => [data.injury, ...prev]);
    setInjuryPart('');
    setInjurySeverity('moderate');
    setShowInjuryForm(false);
  }

  async function resolveInjury(id: string) {
    setInjuries((prev) => prev.filter((i) => i.id !== id));
    await fetch('/api/injuries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'resolved' }) });
  }

  async function deleteInjury(id: string) {
    setInjuries((prev) => prev.filter((i) => i.id !== id));
    await fetch('/api/injuries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }

  const activeObjective = objectives.find(o => o.status === 'active') ?? null;
  const today = snapshots[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem('coach-messages', JSON.stringify(messages.slice(-40))); } catch {}
  }, [messages]);

  function clearChat() {
    setMessages([]);
    try { localStorage.removeItem('coach-messages'); } catch {}
  }

  async function sendMessage(text?: string) {
    const content = text ?? input.trim();
    if (!content || streaming) return;

    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.body) throw new Error('No response body');

      // The coach can edit the calendar / injuries via tools — refresh those
      // panels when it does.
      const mutated = res.headers.get('X-Coach-Mutated') ?? '';
      if (mutated.includes('injuries')) loadInjuries();
      if (mutated.includes('training')) setCalendarUpdated(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: t('coach.genericError') };
        return updated;
      });
    }

    setStreaming(false);
  }

  async function addObjective(title: string, description?: string, target_date?: string) {
    setAddingObjective(true);
    const res = await fetch('/api/objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, target_date }),
    });
    const data = await res.json();
    if (data.objective) {
      // Pause previous active
      const updated = objectives.map(o => o.status === 'active' ? { ...o, status: 'paused' } : o);
      setObjectives([data.objective, ...updated]);
    }
    setAddingObjective(false);
    setShowObjectiveModal(false);
    setShowPresets(false);
    setCustomTitle('');
    setCustomDesc('');
    setCustomDate('');
  }

  async function deleteObjective(id: string) {
    await fetch('/api/objectives', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setObjectives(prev => prev.filter(o => o.id !== id));
  }

  async function completeObjective(id: string) {
    await fetch('/api/objectives', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'completed' }),
    });
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, status: 'completed' } : o));
  }

  const quickPrompts = [
    t('coach.quickPrompts.planWeek'),
    t('coach.quickPrompts.trainToday'),
    t('coach.quickPrompts.recovery'),
    t('coach.quickPrompts.overtraining'),
    activeObjective
      ? t('coach.quickPrompts.buildPlan', { title: activeObjective.title })
      : t('coach.quickPrompts.whatObjective'),
  ];

  return (
    <div className="flex h-[calc(100dvh-0px)] lg:h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Left sidebar - objectives + metrics */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r overflow-y-auto"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('coach.objectives')}</p>
            <button onClick={() => setShowObjectiveModal(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus size={14} weight="bold" />
            </button>
          </div>

          {activeObjective ? (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(232,82,28,0.08)', border: '1px solid rgba(232,82,28,0.2)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{activeObjective.title}</p>
                </div>
              </div>
              {activeObjective.description && (
                <p className="text-xs mt-1.5 ml-5" style={{ color: 'var(--text-3)' }}>{activeObjective.description}</p>
              )}
              {activeObjective.target_date && (
                <p className="text-xs mt-1 ml-5 font-medium" style={{ color: 'var(--accent)' }}>
                  {t('coach.target', { date: new Date(activeObjective.target_date).toLocaleDateString(localeTag, { month: 'short', day: 'numeric', year: 'numeric' }) })}
                </p>
              )}
              <div className="flex gap-2 mt-2.5 ml-5">
                <button onClick={() => completeObjective(activeObjective.id)}
                  className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: '#22c55e' }}>
                  <CheckCircle size={12} /> {t('common.done')}
                </button>
                <button onClick={() => deleteObjective(activeObjective.id)}
                  className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: 'var(--text-3)' }}>
                  <Trash size={12} /> {t('common.remove')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowObjectiveModal(true)}
              className="w-full py-3 rounded-xl text-xs font-medium cursor-pointer border-dashed border-2 flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-3)' }}>
              <Plus size={12} /> {t('coach.setObjective')}
            </button>
          )}

          {/* Completed/paused objectives */}
          {objectives.filter(o => o.status !== 'active').length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {objectives.filter(o => o.status !== 'active').map(o => (
                <div key={o.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{ background: 'var(--surface-2)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{o.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: o.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'var(--border)', color: o.status === 'completed' ? '#22c55e' : 'var(--text-3)' }}>
                    {t(o.status === 'completed' ? 'coach.status.completed' : 'coach.status.paused')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Injuries */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Bandaids size={14} style={{ color: 'var(--text-2)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('coach.injuries')}</p>
            </div>
            <button onClick={() => setShowInjuryForm((v) => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
              {showInjuryForm ? <X size={13} /> : <Plus size={13} weight="bold" />}
            </button>
          </div>

          {showInjuryForm && (
            <div className="flex flex-col gap-2 mb-3">
              <input type="text" value={injuryPart} onChange={(e) => setInjuryPart(e.target.value)}
                placeholder={t('coach.injuryPlaceholder')}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }} />
              <div className="flex gap-2">
                <select value={injurySeverity} onChange={(e) => setInjurySeverity(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}>
                  <option value="mild">{t('coach.severity.mild')}</option>
                  <option value="moderate">{t('coach.severity.moderate')}</option>
                  <option value="severe">{t('coach.severity.severe')}</option>
                </select>
                <button onClick={addInjury} disabled={!injuryPart.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff' }}>{t('common.add')}</button>
              </div>
            </div>
          )}

          {injuries.length === 0 && !showInjuryForm ? (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{t('coach.injuryEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {injuries.map((inj) => (
                <div key={inj.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: 'var(--red-bg)' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--red)' }} />
                  <span className="text-xs flex-1 capitalize truncate" style={{ color: 'var(--text-1)' }}>
                    {inj.body_part}
                    <span className="ml-1" style={{ color: 'var(--text-3)' }}>· {t(`coach.severity.${inj.severity}`)}</span>
                  </span>
                  <button onClick={() => resolveInjury(inj.id)} title={t('coach.markHealed')} className="cursor-pointer" style={{ color: 'var(--green)' }}>
                    <CheckCircle size={14} />
                  </button>
                  <button onClick={() => deleteInjury(inj.id)} title={t('common.remove')} className="cursor-pointer" style={{ color: 'var(--text-3)' }}>
                    <Trash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's metrics snapshot */}
        {today && (
          <div className="p-5">
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{t('common.today')}</p>
            <div className="flex flex-col gap-2.5">
              {[
                { key: 'steps', label: t('metrics.steps'), value: today.steps ? `${(today.steps as number).toLocaleString(localeTag)}` : '--' },
                { key: 'sleep', label: t('metrics.sleep'), value: fmtSleep(today.sleep_seconds as number | null) },
                { key: 'hrv', label: t('metrics.hrv'), value: today.hrv_last_night ? `${Math.round(today.hrv_last_night as number)} ms` : '--' },
                { key: 'bodyBattery', label: t('metrics.bodyBattery'), value: today.body_battery_high ? `${today.body_battery_high} / 100` : '--' },
                { key: 'stress', label: t('coach.stress'), value: today.avg_stress ? `${today.avg_stress} / 100` : '--' },
                { key: 'restingHr', label: t('metrics.restingHr'), value: today.resting_hr ? `${today.resting_hr} bpm` : '--' },
              ].map(({ key, label, value }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Robot size={18} color="white" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('coach.healthCoach')}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {activeObjective ? t('coach.trainingFor', { title: activeObjective.title }) : t('coach.poweredBy')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={clearChat} title={t('coach.clearChat')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                <ArrowCounterClockwise size={13} />
                <span className="hidden sm:inline">{t('coach.newChat')}</span>
              </button>
            )}
            <button onClick={() => setShowObjectiveModal(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <Target size={13} />
              {activeObjective ? activeObjective.title : t('coach.setGoal')}
            </button>
          </div>
        </div>

        {/* Calendar updated banner */}
        {calendarUpdated && (
          <Link href="/calendar" onClick={() => setCalendarUpdated(false)}
            className="mx-6 mt-3 flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))' }}>
            <CalendarCheck size={16} style={{ color: 'var(--accent)' }} weight="fill" />
            <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-1)' }}>{t('coach.calendarUpdated')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{t('coach.viewCalendar')}</span>
          </Link>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(232,82,28,0.1)' }}>
                <Robot size={32} style={{ color: 'var(--accent)' }} weight="fill" />
              </div>
              <div>
                <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
                  {t('coach.emptyTitle')}
                </p>
                <p className="text-sm max-w-sm" style={{ color: 'var(--text-2)' }}>
                  {t('coach.emptyBody')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}
                style={{
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                }}>
                {msg.role === 'user'
                  ? <User size={13} color="white" weight="bold" />
                  : <Robot size={13} style={{ color: 'var(--accent)' }} weight="fill" />
                }
              </div>
              <div className="max-w-[75%] rounded-2xl px-4 py-3"
                style={{
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-1)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderTopRightRadius: msg.role === 'user' ? 6 : undefined,
                  borderTopLeftRadius: msg.role === 'assistant' ? 6 : undefined,
                }}>
                {msg.content
                  ? <MarkdownMessage content={msg.content} isUser={msg.role === 'user'} />
                  : (streaming && i === messages.length - 1 ? (
                    <span className="flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                    </span>
                  ) : '')
                }
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts (when chatting) */}
        {messages.length > 0 && (
          <div className="px-6 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {quickPrompts.slice(0, 3).map((prompt) => (
              <button key={prompt} onClick={() => sendMessage(prompt)} disabled={streaming}
                className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer flex-shrink-0 disabled:opacity-40"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-6 pb-6 pt-2 flex-shrink-0">
          <div className="flex items-end gap-3 rounded-2xl p-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder={t('coach.inputPlaceholder')}
              rows={1}
              className="flex-1 text-sm outline-none resize-none bg-transparent"
              style={{ color: 'var(--text-1)', maxHeight: 120 }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--accent)' }}>
              <PaperPlaneTilt size={15} color="white" weight="fill" />
            </button>
          </div>
          <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-3)' }}>
            {t('coach.basedOn')}
          </p>
        </div>
      </div>

      {/* Objective modal */}
      {showObjectiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowObjectiveModal(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-1)' }}>{t('coach.setObjective')}</h3>

            {/* Presets */}
            <div className="mb-4">
              <button onClick={() => setShowPresets(!showPresets)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm cursor-pointer"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                {t('coach.modal.choosePresets')}
                <CaretDown size={14} className={showPresets ? 'rotate-180' : ''} style={{ transition: 'transform 0.2s' }} />
              </button>
              {showPresets && (
                <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {PRESET_OBJECTIVE_KEYS.map((presetKey) => {
                    const presetTitle = t(`coach.presets.${presetKey}.title`);
                    const presetDesc = t(`coach.presets.${presetKey}.description`);
                    return (
                    <button key={presetKey}
                      onClick={() => addObjective(presetTitle, presetDesc)}
                      disabled={addingObjective}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors disabled:opacity-50"
                      style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-1)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <Target size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <p className="text-sm font-medium">{presetTitle}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{presetDesc}</p>
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{t('coach.modal.orCustom')}</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={t('coach.modal.titlePlaceholder')}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
              />
              <textarea
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder={t('coach.modal.descPlaceholder')}
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
              />
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
              />
              <div className="flex gap-2 mt-1">
                <button onClick={() => setShowObjectiveModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm cursor-pointer"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                  {t('common.cancel')}
                </button>
                <button onClick={() => addObjective(customTitle, customDesc, customDate)}
                  disabled={!customTitle.trim() || addingObjective}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {addingObjective ? t('coach.saving') : t('coach.modal.setObjective')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
