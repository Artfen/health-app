import 'server-only';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, normalizeLocale, type Locale } from './config';
import { makeT } from './translate';

// Read the active locale on the server (from the cookie set by the client).
// Falls back to the default locale.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}

// Server-side translator for the few server components that render copy.
export async function getT() {
  const locale = await getLocale();
  return makeT(locale);
}
