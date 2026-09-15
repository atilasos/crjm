/** Shared by the browser and server; never infer a pupil's language from their device. */
export const LOCALES = {
  'pt-PT': { name: 'Português', direction: 'ltr', numberLocale: 'pt-PT' },
  en: { name: 'English', direction: 'ltr', numberLocale: 'en-GB' },
  ne: { name: 'नेपाली', direction: 'ltr', numberLocale: 'ne-u-nu-latn' },
} as const;
export type Locale = keyof typeof LOCALES;
export const SUPPORTED_LOCALES = Object.keys(LOCALES) as Locale[];
export const DEFAULT_LOCALE: Locale = 'pt-PT';
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(LOCALES, value);
}
export function localeOrDefault(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
