'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_TAG, type Locale } from './config';
import { makeT, type TFunction } from './translate';

type I18nValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunction;
  localeTag: string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // Persist for SSR (<html lang>) and future visits.
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: makeT(locale),
    localeTag: LOCALE_TAG[locale] ?? LOCALE_TAG[DEFAULT_LOCALE],
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT() {
  return useI18n().t;
}
