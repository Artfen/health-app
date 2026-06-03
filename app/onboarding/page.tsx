'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pulse, WifiHigh, CheckCircle, Warning } from '@phosphor-icons/react';

type Step = 'welcome' | 'garmin' | 'success';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');

  async function connectGarmin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/garmin/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garminEmail, garminPassword }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Connection failed');
    } else {
      setDisplayName(data.displayName ?? 'Athlete');
      setStep('success');
    }
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--accent)' }}>
            <Pulse size={32} weight="bold" color="white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
            Welcome to PulseSync
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Connect your Garmin Fenix to start tracking your health and competing with friends.
          </p>

          <div className="flex flex-col gap-3 text-left rounded-2xl p-6 mb-8" style={cardStyle}>
            {[
              { icon: '🏃', text: 'Activities, steps, and distance' },
              { icon: '💤', text: 'Sleep quality and recovery' },
              { icon: '💚', text: 'HRV, body battery, and stress' },
              { icon: '👥', text: 'Compare metrics with friends' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('garmin')}
            className="w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
            style={{ background: 'var(--accent)', color: 'white' }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'var(--accent)')}
          >
            Connect Garmin
          </button>
        </div>
      </div>
    );
  }

  if (step === 'garmin') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
        <div className="w-full max-w-sm">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--accent-muted)' }}>
            <WifiHigh size={24} style={{ color: 'var(--accent)' }} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-center mb-2" style={{ color: 'var(--text-primary)' }}>
            Connect Garmin Connect
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
            Your credentials are used only to fetch your data and are stored encrypted.
          </p>

          <div className="rounded-2xl p-6" style={cardStyle}>
            <form onSubmit={connectGarmin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Garmin Connect email
                </label>
                <input
                  type="email"
                  value={garminEmail}
                  onChange={(e) => setGarminEmail(e.target.value)}
                  placeholder="your@garmin-email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Garmin Connect password
                </label>
                <input
                  type="password"
                  value={garminPassword}
                  onChange={(e) => setGarminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <Warning size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
            Note: Disable MFA on your Garmin account before connecting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(34,197,94,0.15)' }}>
          <CheckCircle size={36} style={{ color: 'var(--success)' }} weight="fill" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          Connected!
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Welcome, {displayName}. Your Garmin data is being synced.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
