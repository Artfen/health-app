// Pure (framework-agnostic) translation machinery, safe to import from both
// server and client code.
import en from './dictionaries/en';
import fr from './dictionaries/fr';
import es from './dictionaries/es';
import de from './dictionaries/de';
import { PARTS } from './dictionaries/parts';
import { DEFAULT_LOCALE, LOCALE_TAG, LOCALES, type Locale } from './config';

type Dict = { [k: string]: string | Dict };

function deepMerge(target: Dict, source: Dict): Dict {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && tv && typeof tv === 'object') {
      deepMerge(tv as Dict, sv as Dict);
    } else {
      target[key] = sv as string | Dict;
    }
  }
  return target;
}

const BASE: Record<Locale, Dict> = { en, fr, es, de };

// Merge per-area parts into the base dictionaries (mutating fresh copies).
export const DICTS: Record<Locale, Dict> = LOCALES.reduce((acc, loc) => {
  const merged: Dict = deepMerge({}, BASE[loc]);
  for (const part of PARTS) {
    const node = part[loc];
    if (node) deepMerge(merged, node as Dict);
  }
  acc[loc] = merged;
  return acc;
}, {} as Record<Locale, Dict>);

export type Vars = Record<string, string | number>;

function resolve(dict: Dict, path: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of path.split('.')) {
    if (node == null || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(str: string, vars?: Vars): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export type TFunction = (key: string, vars?: Vars) => string;

export function makeT(locale: Locale): TFunction {
  const dict = DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
  const tag = LOCALE_TAG[locale] ?? LOCALE_TAG[DEFAULT_LOCALE];
  const plural = new Intl.PluralRules(tag);
  return function t(key: string, vars?: Vars): string {
    let lookupKey = key;
    if (vars && typeof vars.count === 'number') {
      lookupKey = `${key}_${plural.select(vars.count)}`;
    }
    const value =
      resolve(dict, lookupKey) ??
      resolve(dict, key) ??
      resolve(DICTS[DEFAULT_LOCALE], lookupKey) ??
      resolve(DICTS[DEFAULT_LOCALE], key);
    if (value == null) return key;
    return interpolate(value, vars);
  };
}
