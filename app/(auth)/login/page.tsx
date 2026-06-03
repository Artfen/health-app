'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Pulse } from '@phosphor-icons/react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else { router.push('/dashboard'); router.refresh(); }
  }

  const inputBase = { background: '#fff', border: '1px solid var(--border-strong)', color: 'var(--text-1)', borderRadius: 'var(--r)' };

  return (
    <div className="min-h-[100dvh] flex" style={{ background: 'var(--bg)' }}>
      {/* Left accent panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12" style={{ background: 'var(--accent)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Pulse size={16} weight="bold" color="white" />
          </div>
          <span className="font-bold text-white text-base">PulseSync</span>
        </div>
        <div>
          <p className="text-white/90 text-3xl font-bold leading-snug mb-4">
            Track your health.<br />Beat your friends.
          </p>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Connect your Garmin Fenix and see all your health metrics in one clean dashboard.
          </p>
        </div>
        <p className="text-white/40 text-xs">PulseSync - Garmin Health Dashboard</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Pulse size={16} weight="bold" color="white" />
            </div>
            <span className="font-bold text-base" style={{ color: 'var(--text-1)' }}>PulseSync</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-1)' }}>Welcome back</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>Sign in to your account</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required className="w-full px-4 py-3 text-sm outline-none" style={inputBase}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required className="w-full px-4 py-3 text-sm outline-none" style={inputBase}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')} />
            </div>
            {error && <p className="text-sm px-3 py-2.5 rounded-xl" style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold mt-1 cursor-pointer disabled:opacity-50 text-white"
              style={{ background: 'var(--accent)' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-2)' }}>
            No account?{' '}
            <Link href="/signup" className="font-semibold" style={{ color: 'var(--accent)' }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
