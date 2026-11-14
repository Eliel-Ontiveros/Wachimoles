import type { Locale } from './messages';

/** BCP-47 tag para Intl: la app formatea siempre en 'en-US'. */
export const intlLocale = (_locale?: Locale) => 'en-US';

type DateInput = Date | number | string;

/** Fecha localizada. `options` = Intl.DateTimeFormatOptions (por defecto fecha corta). Nunca lanza. */
export function formatDate(
  value: DateInput,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Hora localizada (HH:mm). */
export function formatTime(value: DateInput, locale: Locale): string {
  return formatDate(value, locale, { hour: '2-digit', minute: '2-digit' });
}

/** Número localizado (coma/punto decimal según idioma). Nunca lanza. */
export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {}
): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(intlLocale(locale), options).format(value);
  } catch {
    return String(value);
  }
}
