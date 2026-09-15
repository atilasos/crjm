import { LOCALES, type Locale } from './locale';

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALES[locale].numberLocale, options).format(value);
}
export function formatDuration(ms: number, locale: Locale): string {
  return formatNumber(ms < 1000 ? ms : ms / 1000, locale, {
    style: 'unit', unit: ms < 1000 ? 'millisecond' : 'second', unitDisplay: 'long',
  });
}
export function formatDateTime(value: Date, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALES[locale].numberLocale, options).format(value);
}
