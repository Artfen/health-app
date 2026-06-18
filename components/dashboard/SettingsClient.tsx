'use client';

import { useState } from 'react';
import { Check, Globe, User, Barbell, Watch } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config';
import AppleWatchSetup from './AppleWatchSetup';

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

  const hasDevice = Boolean(profile.garmin_connected || profile.terra_connected);

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
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{t('appleWatch.title')}</p>
          <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-2)' }}>{t('appleWatch.whyFree')}</p>
          <AppleWatchSetup initialToken={profile.apple_health_token ?? null} />
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
