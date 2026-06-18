'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Pulse } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/onboarding');
    }
  }

  const inputStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Pulse size={20} weight="bold" color="white" />
          </div>
          <span className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            PulseSync
          </span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('auth.createAccount')}
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            {t('auth.signUpSubtitle')}
          </p>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('auth.name')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordHint')}
                minLength={8}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
              />
            </div>

            {error && (
              <p className="text-sm px-3 py-2.5 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}
              onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.background = 'var(--accent-hover)')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'var(--accent)')}
            >
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
