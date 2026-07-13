import { cookies } from 'next/headers';
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from './config';
import { dictionaries, type DictKey } from './dictionary';

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDict(): Promise<{ locale: Locale; t: (key: DictKey) => string }> {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return { locale, t: (key: DictKey) => dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key };
}
