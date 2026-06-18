'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { House, Pulse, Moon, Users, SignOut, WifiHigh, Brain, CalendarBlank, Barbell, Gear } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/I18nProvider';

type Profile = {
  full_name: string | null;
  email: string;
  garmin_connected: boolean;
  garmin_display_name: string | null;
} | null;

// `mobile: false` keeps an item off the compact bottom bar (still reachable on
// desktop and via in-app links) so the mobile bar stays at a clean 5 items.
// `labelKey` is an i18n key resolved at render time; `mobile: false` keeps an
// item off the compact bottom bar (still reachable on desktop and via in-app
// links) so the mobile bar stays at a clean 5 items.
const NAV = [
  { href: '/dashboard', icon: House, labelKey: 'nav.overview', mobile: true },
  { href: '/activities', icon: Pulse, labelKey: 'nav.activities', mobile: true },
  { href: '/sleep', icon: Moon, labelKey: 'nav.sleep', mobile: false },
  { href: '/calendar', icon: CalendarBlank, labelKey: 'nav.calendar', mobile: true },
  { href: '/group', icon: Users, labelKey: 'nav.group', mobile: false },
  { href: '/team', icon: Barbell, labelKey: 'nav.team', mobile: true },
  { href: '/coach', icon: Brain, labelKey: 'nav.coach', mobile: true },
];

function SignOutButton({ onClick, label }: { onClick: () => void; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150"
      style={{
        background: hovered ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
        color: hovered ? 'var(--accent)' : 'var(--text-3)',
      }}>
      <SignOut size={18} />
    </button>
  );
}

function NavIcon({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      title={label}
      prefetch={true}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150"
      style={{
        background: active ? 'var(--accent)' : hovered ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
        color: active ? '#fff' : hovered ? 'var(--accent)' : 'var(--text-3)',
      }}
    >
      {children}
    </Link>
  );
}

export default function Sidebar({ user }: { user: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

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
          {NAV.map(({ href, icon: Icon, labelKey }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <NavIcon key={href} href={href} label={t(labelKey)} active={active}>
                <Icon size={18} weight={active ? 'fill' : 'regular'} />
              </NavIcon>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-1 w-full px-2">
          {user && !user.garmin_connected && (
            <Link href="/onboarding" title={t('nav.connectGarmin')}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ color: 'var(--amber)' }}>
              <WifiHigh size={18} />
            </Link>
          )}
          <NavIcon href="/settings" label={t('nav.settings')} active={pathname.startsWith('/settings')}>
            <Gear size={18} weight={pathname.startsWith('/settings') ? 'fill' : 'regular'} />
          </NavIcon>
          <SignOutButton onClick={signOut} label={t('common.signOut')} />
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 flex lg:hidden z-20"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        {[...NAV.filter((n) => n.mobile), { href: '/settings', icon: Gear, labelKey: 'nav.settings' }].map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium"
              style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
