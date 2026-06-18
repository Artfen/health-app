'use client';

import { useState } from 'react';
import { Copy, Check, ArrowClockwise, AppleLogo, ArrowSquareOut } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';

// After you publish the Apple Shortcut, paste its iCloud share link here so the
// "Add the shortcut" button appears. Leave '' and we show a gentle note instead.
export const SHORTCUT_INSTALL_URL = '';

// Friendly, walk-you-through-it Apple Watch sync setup. Reused in onboarding
// and in Settings. `onDone` (onboarding) shows a finish button.
export default function AppleWatchSetup({
  initialToken = null,
  onDone,
}: { initialToken?: string | null; onDone?: () => void }) {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = token ? `${origin}/api/apple-health/ingest?token=${token}` : '';

  async function start(regenerate = false) {
    setBusy(true);
    const res = await fetch('/api/apple-health/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerate }),
    });
    const data = await res.json();
    if (data.token) setToken(data.token);
    setBusy(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the field is selectable as a fallback */ }
  }

  // Not started yet → one big friendly button.
  if (!token) {
    return (
      <button onClick={() => start()} disabled={busy}
        className="w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: '#1d1d1f', color: '#fff' }}>
        <AppleLogo size={18} weight="fill" />
        {busy ? t('appleWatch.generating') : t('appleWatch.start')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step 1 — add the shortcut */}
      <StepRow n={1} title={t('appleWatch.step1Title')} body={t('appleWatch.step1Body')}>
        {SHORTCUT_INSTALL_URL ? (
          <a href={SHORTCUT_INSTALL_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <ArrowSquareOut size={15} weight="bold" /> {t('appleWatch.addShortcut')}
          </a>
        ) : (
          <p className="text-[11px] mt-2 italic" style={{ color: 'var(--text-3)' }}>{t('appleWatch.step1NoLinkYet')}</p>
        )}
      </StepRow>

      {/* Step 2 — copy the secret link */}
      <StepRow n={2} title={t('appleWatch.step2Title')} body={t('appleWatch.step2Body')}>
        <div className="flex items-center gap-2 mt-2">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
            className="flex-1 px-3 py-2 rounded-lg text-xs outline-none font-mono"
            style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }} />
          <button onClick={copy}
            className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {copied ? <><Check size={13} weight="bold" /> {t('appleWatch.copied')}</> : <><Copy size={13} /> {t('appleWatch.copy')}</>}
          </button>
        </div>
      </StepRow>

      {/* Step 3 — paste into the shortcut */}
      <StepRow n={3} title={t('appleWatch.step3Title')} body={t('appleWatch.step3Body')} />

      {/* Step 4 — make it automatic */}
      <StepRow n={4} title={t('appleWatch.step4Title')} body={t('appleWatch.step4Body')} last />

      <div className="flex items-center justify-between gap-3 pt-1">
        <button onClick={() => start(true)} disabled={busy}
          className="text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
          style={{ color: 'var(--text-3)' }}>
          <ArrowClockwise size={12} /> {t('appleWatch.reset')}
        </button>
        {onDone && (
          <button onClick={onDone}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {t('appleWatch.done')}
          </button>
        )}
      </div>
    </div>
  );
}

// A numbered step with a connecting line down the left, so it reads like a checklist.
function StepRow({ n, title, body, children, last }: { n: number; title: string; body: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}>{n}</div>
        {!last && <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)' }} />}
      </div>
      <div className={last ? '' : 'pb-1'}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{body}</p>
        {children}
      </div>
    </div>
  );
}
