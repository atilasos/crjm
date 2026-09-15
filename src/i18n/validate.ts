import { catalogs } from './catalogs';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locale';

/** Build-time contract: adding a language or message requires complete catalogues. */
export function validateCatalogs(
  input: Readonly<Record<string, Readonly<Record<string, string>>>> = catalogs,
  locales: readonly string[] = SUPPORTED_LOCALES,
): string[] {
  const errors: string[] = [];
  const base = input[DEFAULT_LOCALE];
  if (!base) return ['Missing default catalogue: ' + DEFAULT_LOCALE];
  const keys = Object.keys(base);
  const slots = (value: string) => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort().join(',');
  for (const locale of locales) {
    const catalog = input[locale];
    if (!catalog) { errors.push(`Missing catalogue: ${locale}`); continue; }
    for (const key of keys) {
      const value = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
      if (typeof value !== 'string' || !value.trim()) errors.push(`${locale}: missing/empty message: ${key}`);
      else if (slots(value) !== slots(key)) errors.push(`${locale}: interpolation mismatch: ${key}`);
      if (key !== key.replace(/\s+/g, ' ').trim()) errors.push(`${locale}: noncanonical key: ${key}`);
    }
    for (const key of Object.keys(catalog)) if (!Object.hasOwn(base, key)) errors.push(`${locale}: unknown message: ${key}`);
  }
  for (const locale of Object.keys(input)) if (!locales.includes(locale)) errors.push(`Unregistered catalogue: ${locale}`);
  return errors;
}
