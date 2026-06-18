import type { Locale } from '../../config';

// A "part" contributes one or more namespaces to every locale's dictionary.
// Shape: { en: { <namespace>: {...} }, fr: {...}, es: {...}, de: {...} }
export type DictNode = { [k: string]: string | DictNode };
export type Part = Partial<Record<Locale, Record<string, DictNode>>>;
