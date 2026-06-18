export const LOCALES = ['en', 'fr', 'es', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
};

// BCP-47 tags for Intl date/number formatting per locale.
export const LOCALE_TAG: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
};

export const LOCALE_COOKIE = 'locale';

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

export function normalizeLocale(v: unknown): Locale {
  if (isLocale(v)) return v;
  // Accept region-tagged values like "fr-FR" or browser Accept-Language fragments.
  if (typeof v === 'string') {
    const base = v.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
