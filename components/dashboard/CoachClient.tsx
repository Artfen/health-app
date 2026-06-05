'use client';

import { useState, useRef, useEffect } from 'react';
import { PaperPlaneTilt, Robot, User, Plus, Target, CheckCircle, Trash, CaretDown } from '@phosphor-icons/react';

type Snapshot = Record<string, unknown>;
type Objective = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
};

type Message = { role: 'user' | 'assistant'; content: string };

const PRESET_OBJECTIVES = [
  { title: 'Hyrox', description: 'Complete a Hyrox race — 8km running + 8 functional fitness stations' },
  { title: 'Marathon', description: 'Complete a 42.2km marathon' },
  { title: 'Half Marathon', description: 'Complete a 21.1km half marathon' },
  { title: 'Sub 20 min 5k', description: 'Run 5km in under 20 minutes' },
  { title: 'Sub 45 min 10k', description: 'Run 10km in under 45 minutes' },
  { title: 'Triathlon', description: 'Complete a triathlon (swim, bike, run)' },
  { title: 'Improve HRV', description: 'Consistently improve heart rate variability through better recovery' },
  { title: 'Lose weight', description: 'Reduce body weight through training and nutrition' },
  { title: 'Build strength', description: 'Increase overall strength through progressive overload' },
  { title: 'Ultra trail run', description: 'Complete an ultra trail running event (50km+)' },
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
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [addingObjective, setAddingObjective] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeObjective = objectives.find(o => o.status === 'active') ?? null;
  const today = snapshots[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Try again.' };
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
    'How is my recovery today?',
    'What should I train today?',
    'Analyse my sleep this week',
    'Am I overtraining?',
    activeObjective ? `How am I progressing toward my ${activeObjective.title}?` : 'What objective should I set?',
  ];

  return (
    <div className="flex h-[calc(100dvh-0px)] lg:h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Left sidebar - objectives + metrics */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r overflow-y-auto"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Objectives</p>
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
                  Target: {new Date(activeObjective.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <div className="flex gap-2 mt-2.5 ml-5">
                <button onClick={() => completeObjective(activeObjective.id)}
                  className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: '#22c55e' }}>
                  <CheckCircle size={12} /> Done
                </button>
                <button onClick={() => deleteObjective(activeObjective.id)}
                  className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: 'var(--text-3)' }}>
                  <Trash size={12} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowObjectiveModal(true)}
              className="w-full py-3 rounded-xl text-xs font-medium cursor-pointer border-dashed border-2 flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-3)' }}>
              <Plus size={12} /> Set an objective
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
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's metrics snapshot */}
        {today && (
          <div className="p-5">
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Today</p>
            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Steps', value: today.steps ? `${(today.steps as number).toLocaleString()}` : '--' },
                { label: 'Sleep', value: fmtSleep(today.sleep_seconds as number | null) },
                { label: 'HRV', value: today.hrv_last_night ? `${Math.round(today.hrv_last_night as number)} ms` : '--' },
                { label: 'Body Battery', value: today.body_battery_high ? `${today.body_battery_high} / 100` : '--' },
                { label: 'Stress', value: today.avg_stress ? `${today.avg_stress} / 100` : '--' },
                { label: 'Resting HR', value: today.resting_hr ? `${today.resting_hr} bpm` : '--' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
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
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Health Coach</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {activeObjective ? `Training for: ${activeObjective.title}` : 'Powered by your Garmin data'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowObjectiveModal(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <Target size={13} />
            {activeObjective ? activeObjective.title : 'Set goal'}
          </button>
        </div>

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
                  Your personal health coach
                </p>
                <p className="text-sm max-w-sm" style={{ color: 'var(--text-2)' }}>
                  I have access to your full Garmin data. Ask me anything about your training, recovery, or performance.
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
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap`}
                style={{
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-1)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderTopRightRadius: msg.role === 'user' ? 6 : undefined,
                  borderTopLeftRadius: msg.role === 'assistant' ? 6 : undefined,
                }}>
                {msg.content || (streaming && i === messages.length - 1 ? (
                  <span className="flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                  </span>
                ) : '')}
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
              placeholder="Ask your coach anything..."
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
            Based on your last 30 days of Garmin data
          </p>
        </div>
      </div>

      {/* Objective modal */}
      {showObjectiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowObjectiveModal(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Set an objective</h3>

            {/* Presets */}
            <div className="mb-4">
              <button onClick={() => setShowPresets(!showPresets)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm cursor-pointer"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                Choose from presets
                <CaretDown size={14} className={showPresets ? 'rotate-180' : ''} style={{ transition: 'transform 0.2s' }} />
              </button>
              {showPresets && (
                <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {PRESET_OBJECTIVES.map((preset) => (
                    <button key={preset.title}
                      onClick={() => addObjective(preset.title, preset.description)}
                      disabled={addingObjective}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors disabled:opacity-50"
                      style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-1)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <Target size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <p className="text-sm font-medium">{preset.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{preset.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>or custom</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Objective title (e.g. Ironman 70.3)"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
              />
              <textarea
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Description (optional)"
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
                  Cancel
                </button>
                <button onClick={() => addObjective(customTitle, customDesc, customDate)}
                  disabled={!customTitle.trim() || addingObjective}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {addingObjective ? 'Saving...' : 'Set objective'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
