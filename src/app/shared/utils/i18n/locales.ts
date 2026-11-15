import { readItem } from '../safe-storage';

export const LOCALES = {
  en: { name: 'English', dir: 'ltr', speech: 'en-US' },
  ar: { name: 'العربية', dir: 'rtl', speech: 'ar-SA' },
} as const;

export type Locale = keyof typeof LOCALES;

export const LOCALE_OPTIONS = Object.entries(LOCALES).map(([code, { name }]) => ({ code, name }));

export const DEFAULT_LOCALE: Locale = 'ar';

export const LOCALE_STORAGE_KEY = 'jtalk:locale';

export const isLocale = (value: string | null): value is Locale =>
  value !== null && Object.hasOwn(LOCALES, value);

export const savedLocale = (): Locale => {
  const saved = readItem('local', LOCALE_STORAGE_KEY);
  return isLocale(saved) ? saved : DEFAULT_LOCALE;
};
