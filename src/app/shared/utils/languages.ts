import { msg } from '@shared/utils/i18n/msg';

export interface Language {
  readonly code: string;
  readonly flag: string;
  readonly name: string;
}

/** The languages a room can practise (`name` is English wording, translated for display). */
export const LANGUAGES: readonly Language[] = [
  { code: 'en', flag: '🇬🇧', name: msg('English') },
  { code: 'es', flag: '🇪🇸', name: msg('Spanish') },
  { code: 'ar', flag: '🇸🇦', name: msg('Arabic') },
  { code: 'fr', flag: '🇫🇷', name: msg('French') },
  { code: 'de', flag: '🇩🇪', name: msg('German') },
  { code: 'ja', flag: '🇯🇵', name: msg('Japanese') },
  { code: 'zh', flag: '🇨🇳', name: msg('Chinese') },
  { code: 'pt', flag: '🇧🇷', name: msg('Portuguese') },
  { code: 'ru', flag: '🇷🇺', name: msg('Russian') },
  { code: 'tr', flag: '🇹🇷', name: msg('Turkish') },
  { code: 'hi', flag: '🇮🇳', name: msg('Hindi') },
  { code: 'it', flag: '🇮🇹', name: msg('Italian') },
];

/** A code the list does not know is shown as it is, with a neutral flag. */
export function languageOf(code: string): Language {
  return LANGUAGES.find((language) => language.code === code) ?? { code, flag: '🏳️', name: code };
}
