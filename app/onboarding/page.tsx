'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pulse, WifiHigh, CheckCircle, Warning, DeviceMobile } from '@phosphor-icons/react';

type Step = 'welcome' | 'choose' | 'garmin' | 'terra' | 'success';
type SuccessSource = 'garmin' | 'terra';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [successSource, setSuccessSource] = useState<SuccessSource>('garmin');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

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
    } else if (data.mfaRequired) {
      // Garmin emailed/texted a code — switch to the code-entry view.
      setMfaRequired(true);
    } else {
      setDisplayName(data.displayName ?? 'Athlete');
      setSuccessSource('garmin');
      setStep('success');
    }
  }

  async function submitMfaCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/garmin/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Verification failed');
      // Session expired server-side — send them back to re-enter credentials.
      if (data.restart) {
        setMfaRequired(false);
        setMfaCode('');
      }
    } else {
      setDisplayName(data.displayName ?? 'Athlete');
      setSuccessSource('garmin');
      setStep('success');
    }
  }

  async function connectTerra() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/terra/connect', { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Failed to start connection');
    } else {
      // Open Terra widget in same tab - it will redirect back on completion
      window.location.href = data.url;
    }
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--accent)' }}>
            <Pulse size={32} weight="bold" color="white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-3" style={{ color: 'var(--text-1)' }}>
            Welcome to PulseSync
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-sm mx-auto" style={{ color: 'var(--text-2)' }}>
            Connect your wearable to start tracking your health and competing with friends.
          </p>

          <div className="flex flex-col gap-3 text-left rounded-2xl p-6 mb-8" style={cardStyle}>
            {[
              'Activities, steps, and distance',
              'Sleep quality and recovery',
              'HRV, body battery, and stress',
              'Compare metrics with friends',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-2)' }}>{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('choose')}
            className="w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Get started
          </button>
        </div>
      </div>
    );
  }

  if (step === 'choose') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-center mb-2" style={{ color: 'var(--text-1)' }}>
            Choose your device
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-2)' }}>
            Connect your wearable to start syncing data.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep('garmin')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl text-left cursor-pointer transition-all"
              style={{ ...cardStyle, borderColor: 'var(--border)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
                <WifiHigh size={20} color="white" weight="bold" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Garmin</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Fenix, Forerunner, Vivoactive...</p>
              </div>
            </button>

            <button
              onClick={() => setStep('terra')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl text-left cursor-pointer transition-all"
              style={{ ...cardStyle, borderColor: 'var(--border)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1d1d1f' }}>
                <DeviceMobile size={20} color="white" weight="bold" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Apple Health / Other</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Apple Watch, Fitbit, Whoop, Oura...</p>
              </div>
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full mt-6 py-3 rounded-xl text-sm cursor-pointer"
            style={{ color: 'var(--text-3)' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  if (step === 'garmin') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">
          <button
            onClick={() => {
              if (mfaRequired) {
                setMfaRequired(false);
                setMfaCode('');
                setError('');
              } else {
                setStep('choose');
              }
            }}
            className="text-sm mb-6 cursor-pointer"
            style={{ color: 'var(--text-3)' }}
          >
            Back
          </button>

          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(232,82,28,0.12)' }}>
            <WifiHigh size={24} style={{ color: 'var(--accent)' }} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-center mb-2" style={{ color: 'var(--text-1)' }}>
            {mfaRequired ? 'Enter your code' : 'Connect Garmin'}
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-2)' }}>
            {mfaRequired
              ? 'Garmin sent a verification code to your email or phone. Enter it below to finish connecting.'
              : 'Your credentials are used only to fetch your data and are stored encrypted.'}
          </p>

          {mfaRequired ? (
            <div className="rounded-2xl p-6" style={cardStyle}>
              <form onSubmit={submitMfaCode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-[0.3em] text-center"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--red-bg)' }}>
                    <Warning size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold mt-1 cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {loading ? 'Verifying...' : 'Verify and connect'}
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl p-6" style={cardStyle}>
              <form onSubmit={connectGarmin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Garmin Connect email</label>
                  <input
                    type="email"
                    value={garminEmail}
                    onChange={(e) => setGarminEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Garmin Connect password</label>
                  <input
                    type="password"
                    value={garminPassword}
                    onChange={(e) => setGarminPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--red-bg)' }}>
                    <Warning size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold mt-1 cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </form>
            </div>
          )}

          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-3)' }}>
            Works with 2FA enabled — we&apos;ll ask for your code if Garmin requires one.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'terra') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm text-center">
          <button onClick={() => setStep('choose')} className="text-sm mb-6 cursor-pointer block" style={{ color: 'var(--text-3)' }}>
            Back
          </button>

          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: '#1d1d1f' }}>
            <DeviceMobile size={24} color="white" weight="bold" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-1)' }}>
            Apple Health & More
          </h2>
          <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--text-2)' }}>
            Connect Apple Watch, Fitbit, Whoop, Oura, Polar, and more. You'll be redirected to authorize your device.
          </p>

          <div className="rounded-2xl p-5 mb-6 text-left" style={cardStyle}>
            {['Apple Health (Apple Watch)', 'Fitbit', 'Whoop', 'Oura Ring', 'Polar', 'Suunto', 'Withings'].map((device) => (
              <div key={device} className="flex items-center gap-2.5 py-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-2)' }}>{device}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-4 text-left" style={{ background: 'var(--red-bg)' }}>
              <Warning size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <button
            onClick={connectTerra}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
            style={{ background: '#1d1d1f', color: 'white' }}
          >
            {loading ? 'Opening...' : 'Connect my device'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(34,197,94,0.12)' }}>
          <CheckCircle size={36} style={{ color: '#22c55e' }} weight="fill" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Connected!
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
          {successSource === 'garmin'
            ? `Welcome, ${displayName}. Your Garmin data is being synced.`
            : 'Your device is connected. Data will sync automatically.'}
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
