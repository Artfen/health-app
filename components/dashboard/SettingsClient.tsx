'use client';

import { useState } from 'react';
import { Check, Globe, User, Barbell, Watch, Copy, ArrowClockwise } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config';

// After you publish the Apple Shortcut, paste its iCloud share link here so the
// in-app "Install the shortcut" button works. Leave '' to hide that button.
const SHORTCUT_INSTALL_URL = '';

type Profile = {
  full_name?: string | null;
  locale?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  birth_year?: number | null;
  sex?: string | null;
  garmin_connected?: boolean | null;
  terra_connected?: boolean | null;
  apple_health_token?: string | null;
};

const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' };

export default function SettingsClient({ profile }: { profile: Profile }) {
  const { t, locale, setLocale } = useI18n();

  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [weight, setWeight] = useState(profile.weight_kg?.toString() ?? '');
  const [height, setHeight] = useState(profile.height_cm?.toString() ?? '');
  const [birthYear, setBirthYear] = useState(profile.birth_year?.toString() ?? '');
  const [sex, setSex] = useState(profile.sex ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [appleToken, setAppleToken] = useState<string | null>(profile.apple_health_token ?? null);
  const [appleBusy, setAppleBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasDevice = Boolean(profile.garmin_connected || profile.terra_connected);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const syncUrl = appleToken ? `${origin}/api/apple-health/ingest?token=${appleToken}` : '';

  async function setupApple(regenerate = false) {
    setAppleBusy(true);
    const res = await fetch('/api/apple-health/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerate }),
    });
    const data = await res.json();
    if (data.token) setAppleToken(data.token);
    setAppleBusy(false);
  }

  async function copyLink() {
    if (!syncUrl) return;
    try {
      await navigator.clipboard.writeText(syncUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — user can select the field manually */ }
  }

  async function patch(body: Record<string, unknown>) {
    return fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function chooseLanguage(l: Locale) {
    setLocale(l);          // live switch + cookie
    patch({ locale: l });  // persist to profile (fire-and-forget)
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await patch({
      full_name: fullName,
      weight_kg: weight,
      height_cm: height,
      birth_year: birthYear,
      sex: sex || null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="px-6 py-6 pb-24 lg:pb-8 max-w-[760px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{t('settings.title')}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{t('settings.subtitle')}</p>
      </div>

      {/* Devices — Connect Apple Watch (prominent for users without a device) */}
      <Section icon={<Watch size={18} weight="bold" />} title={t('settings.devices.title')}
        hint={hasDevice ? t('settings.devices.connected') : t('settings.devices.noDevice')}>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('settings.devices.appleTitle')}</p>
          <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-2)' }}>{t('settings.devices.appleDesc')}</p>

          {!appleToken ? (
            <button onClick={() => setupApple(false)} disabled={appleBusy}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {appleBusy ? t('settings.devices.generating') : t('settings.devices.setup')}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{t('settings.devices.yourLink')}</label>
                <div className="flex items-center gap-2 mt-1">
                  <input readOnly value={syncUrl} onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 px-3 py-2 rounded-lg text-xs outline-none font-mono" style={inputStyle} />
                  <button onClick={copyLink}
                    className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 flex-shrink-0"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {copied
                      ? <><Check size={13} weight="bold" /> {t('settings.devices.copied')}</>
                      : <><Copy size={13} /> {t('settings.devices.copy')}</>}
                  </button>
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{t('settings.devices.linkHint')}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>{t('settings.devices.stepsTitle')}</p>
                <ol className="flex flex-col gap-1.5 text-xs list-decimal pl-4" style={{ color: 'var(--text-2)' }}>
                  <li>{t('settings.devices.step1')}</li>
                  <li>{t('settings.devices.step2')}</li>
                  <li>{t('settings.devices.step3')}</li>
                  <li>{t('settings.devices.step4')}</li>
                  <li>{t('settings.devices.step5')}</li>
                </ol>
                {SHORTCUT_INSTALL_URL && (
                  <a href={SHORTCUT_INSTALL_URL} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {t('settings.devices.installShortcut')}
                  </a>
                )}
              </div>

              <button onClick={() => setupApple(true)} disabled={appleBusy}
                className="self-start text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                style={{ color: 'var(--text-3)' }}>
                <ArrowClockwise size={12} /> {t('settings.devices.reset')}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Language */}
      <Section icon={<Globe size={18} weight="bold" />} title={t('settings.languageSection')} hint={t('settings.languageHint')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <button key={l} onClick={() => chooseLanguage(l)}
                className="flex items-center justify-between gap-1 px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                style={active
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {LOCALE_NAMES[l]}
                {active && <Check size={14} weight="bold" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Profile */}
      <Section icon={<User size={18} weight="bold" />} title={t('settings.profileSection')}>
        <Field label={t('settings.displayName')}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('settings.displayNamePlaceholder')}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
      </Section>

      {/* Body metrics */}
      <Section icon={<Barbell size={18} weight="bold" />} title={t('settings.bodySection')} hint={t('settings.bodyHint')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('settings.weight')} (kg)`}>
            <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label={`${t('settings.height')} (cm)`}>
            <input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label={t('settings.birthYear')}>
            <input type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1990"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label={t('settings.sex')}>
            <select value={sex} onChange={(e) => setSex(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>
              <option value="">{t('settings.sexUnset')}</option>
              <option value="male">{t('settings.sexMale')}</option>
              <option value="female">{t('settings.sexFemale')}</option>
            </select>
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={save} disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {saved && (
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--green)' }}>
            <Check size={15} weight="bold" /> {t('settings.saved')}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-1)' }}>
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {hint && <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  );
}
