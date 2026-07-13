export type Locale = 'vi' | 'en';

export const LOCALE_COOKIE = 'gz_locale';
export const DEFAULT_LOCALE: Locale = 'vi';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'vi' || value === 'en';
}
