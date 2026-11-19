export interface Language {
  readonly code: string;
  readonly flag: string;
  readonly name: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  { code: 'ar', flag: '🇸🇦', name: 'Arabic' },
  { code: 'fr', flag: '🇫🇷', name: 'French' },
  { code: 'de', flag: '🇩🇪', name: 'German' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese' },
  { code: 'pt', flag: '🇧🇷', name: 'Portuguese' },
  { code: 'ru', flag: '🇷🇺', name: 'Russian' },
  { code: 'tr', flag: '🇹🇷', name: 'Turkish' },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi' },
  { code: 'it', flag: '🇮🇹', name: 'Italian' },
];

export function languageOf(code: string): Language {
  return LANGUAGES.find((language) => language.code === code) ?? { code, flag: '🏳️', name: code };
}
