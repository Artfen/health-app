'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, Pulse, Moon, Users, SignOut, WifiHigh, Gear, Brain } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  full_name: string | null;
  email: string;
  garmin_connected: boolean;
  garmin_display_name: string | null;
} | null;

const NAV = [
  { href: '/dashboard', icon: House, label: 'Overview' },
  { href: '/activities', icon: Pulse, label: 'Activities' },
  { href: '/sleep', icon: Moon, label: 'Sleep' },
  { href: '/group', icon: Users, label: 'Group' },
  { href: '/coach', icon: Brain, label: 'AI Coach' },
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
      {/* Desktop icon rail */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-[64px] hidden lg:flex flex-col items-center py-5 z-20"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo mark */}
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-8 flex-shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <span className="text-white font-bold text-sm tracking-tight">P</span>
        </Link>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1 flex-1 w-full px-2">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-3)',
                }}
              >
                <Icon size={18} weight={active ? 'fill' : 'regular'} />
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-1 w-full px-2">
          {user && !user.garmin_connected && (
            <Link href="/onboarding" title="Connect Garmin"
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ color: 'var(--amber)' }}>
              <WifiHigh size={18} />
            </Link>
          )}
          <button onClick={signOut} title="Sign out"
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--text-3)' }}>
            <SignOut size={18} />
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 flex lg:hidden z-20"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium"
              style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
