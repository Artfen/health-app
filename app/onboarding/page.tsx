'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pulse, WifiHigh, CheckCircle, Warning, DeviceMobile, AppleLogo } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import AppleWatchSetup from '@/components/dashboard/AppleWatchSetup';

type Step = 'welcome' | 'choose' | 'apple' | 'garmin' | 'terra' | 'success';
type SuccessSource = 'garmin' | 'terra';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useI18n();
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
      setError(data.error ?? t('onboarding.garmin.connectionFailed'));
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
      setError(data.error ?? t('onboarding.mfa.verificationFailed'));
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
      setError(data.error ?? t('onboarding.terra.startFailed'));
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
            {t('onboarding.welcome.title')}
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-sm mx-auto" style={{ color: 'var(--text-2)' }}>
            {t('onboarding.welcome.subtitle')}
          </p>

          <div className="flex flex-col gap-3 text-left rounded-2xl p-6 mb-8" style={cardStyle}>
            {[
              t('onboarding.welcome.features.activities'),
              t('onboarding.welcome.features.sleep'),
              t('onboarding.welcome.features.metrics'),
              t('onboarding.welcome.features.compare'),
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
            {t('onboarding.welcome.getStarted')}
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
            {t('onboarding.choose.title')}
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-2)' }}>
            {t('onboarding.choose.subtitle')}
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
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('onboarding.choose.garmin')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t('onboarding.choose.garminDevices')}</p>
              </div>
            </button>

            <button
              onClick={() => setStep('apple')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl text-left cursor-pointer transition-all"
              style={{ ...cardStyle, borderColor: 'var(--border)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1d1d1f' }}>
                <AppleLogo size={20} color="white" weight="fill" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('onboarding.choose.appleWatch')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t('onboarding.choose.appleWatchDesc')}</p>
              </div>
            </button>

            <button
              onClick={() => setStep('terra')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl text-left cursor-pointer transition-all"
              style={{ ...cardStyle, borderColor: 'var(--border)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <DeviceMobile size={20} weight="bold" style={{ color: 'var(--text-2)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('onboarding.choose.otherDevices')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{t('onboarding.choose.otherDevicesDesc')}</p>
              </div>
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full mt-6 py-3 rounded-xl text-sm cursor-pointer"
            style={{ color: 'var(--text-3)' }}
          >
            {t('onboarding.choose.skip')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'apple') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md">
          <button onClick={() => setStep('choose')} className="text-sm mb-6 cursor-pointer block" style={{ color: 'var(--text-3)' }}>
            {t('onboarding.common.back')}
          </button>

          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: '#1d1d1f' }}>
            <AppleLogo size={24} color="white" weight="fill" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-center mb-2" style={{ color: 'var(--text-1)' }}>
            {t('appleWatch.title')}
          </h2>
          <p className="text-sm text-center mb-7 max-w-xs mx-auto" style={{ color: 'var(--text-2)' }}>
            {t('appleWatch.subtitle')}
          </p>

          <div className="rounded-2xl p-6" style={cardStyle}>
            <AppleWatchSetup onDone={() => router.push('/dashboard')} />
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full mt-5 py-3 rounded-xl text-sm cursor-pointer"
            style={{ color: 'var(--text-3)' }}
          >
            {t('appleWatch.later')}
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
            {t('onboarding.common.back')}
          </button>

          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(232,82,28,0.12)' }}>
            <WifiHigh size={24} style={{ color: 'var(--accent)' }} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-center mb-2" style={{ color: 'var(--text-1)' }}>
            {mfaRequired ? t('onboarding.mfa.title') : t('onboarding.garmin.title')}
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'var(--text-2)' }}>
            {mfaRequired
              ? t('onboarding.mfa.subtitle')
              : t('onboarding.garmin.subtitle')}
          </p>

          {mfaRequired ? (
            <div className="rounded-2xl p-6" style={cardStyle}>
              <form onSubmit={submitMfaCode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{t('onboarding.mfa.codeLabel')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder={t('onboarding.mfa.codePlaceholder')}
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
                  {loading ? t('onboarding.mfa.verifying') : t('onboarding.mfa.verifyAndConnect')}
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl p-6" style={cardStyle}>
              <form onSubmit={connectGarmin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{t('onboarding.garmin.emailLabel')}</label>
                  <input
                    type="email"
                    value={garminEmail}
                    onChange={(e) => setGarminEmail(e.target.value)}
                    placeholder={t('onboarding.garmin.emailPlaceholder')}
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{t('onboarding.garmin.passwordLabel')}</label>
                  <input
                    type="password"
                    value={garminPassword}
                    onChange={(e) => setGarminPassword(e.target.value)}
                    placeholder={t('onboarding.garmin.passwordPlaceholder')}
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
                  {loading ? t('onboarding.garmin.connecting') : t('onboarding.garmin.connect')}
                </button>
              </form>
            </div>
          )}

          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-3)' }}>
            {t('onboarding.garmin.twoFactorNote')}
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
            {t('onboarding.common.back')}
          </button>

          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: '#1d1d1f' }}>
            <DeviceMobile size={24} color="white" weight="bold" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-1)' }}>
            {t('onboarding.terra.title')}
          </h2>
          <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--text-2)' }}>
            {t('onboarding.terra.subtitle')}
          </p>

          <div className="rounded-2xl p-5 mb-6 text-left" style={cardStyle}>
            {[
              t('onboarding.terra.devices.fitbit'),
              t('onboarding.terra.devices.whoop'),
              t('onboarding.terra.devices.oura'),
              t('onboarding.terra.devices.polar'),
              t('onboarding.terra.devices.suunto'),
              t('onboarding.terra.devices.withings'),
            ].map((device) => (
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
            {loading ? t('onboarding.terra.opening') : t('onboarding.terra.connect')}
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
          {t('onboarding.success.title')}
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
          {successSource === 'garmin'
            ? t('onboarding.success.garminMessage', { name: displayName })
            : t('onboarding.success.terraMessage')}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {t('onboarding.success.goToDashboard')}
        </button>
      </div>
    </div>
  );
}
