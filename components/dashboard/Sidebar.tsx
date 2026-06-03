'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Pulse,
  House,
  Moon,
  Heartbeat,
  Users,
  SignOut,
  WifiHigh,
} from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  full_name: string | null;
  email: string;
  garmin_connected: boolean;
  garmin_display_name: string | null;
} | null;

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: House },
  { href: '/activities', label: 'Activities', icon: Pulse },
  { href: '/sleep', label: 'Sleep', icon: Moon },
  { href: '/group', label: 'Group', icon: Users },
];

export default function Sidebar({ user }: { user: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-64 hidden lg:flex flex-col z-10"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Pulse size={16} weight="bold" color="white" />
          </div>
          <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
            PulseSync
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-4 flex-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? 'var(--accent-muted)' : 'transparent',
                  color: active ? 'var(--accent-hover)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={18} weight={active ? 'fill' : 'regular'} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + signout */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          {user && !user.garmin_connected && (
            <Link
              href="/onboarding"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium mb-2 transition-all"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}
            >
              <WifiHigh size={16} />
              Connect Garmin
            </Link>
          )}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.full_name ?? user?.email?.split('@')[0]}
              </span>
              {user?.garmin_display_name && (
                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {user.garmin_display_name}
                </span>
              )}
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg transition-all cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              title="Sign out"
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex lg:hidden z-10"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all"
              style={{ color: active ? 'var(--accent-hover)' : 'var(--text-secondary)' }}
            >
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
