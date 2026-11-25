export interface LanguageCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
  readonly chipKey: 'all' | 'es' | 'en' | 'fr' | 'ar' | 'ja' | 'de';
}

export const LANGUAGE_CATALOG: readonly LanguageCatalogEntry[] = [
  { code: 'en', name: 'English', flag: '🇬🇧', chipKey: 'en' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', chipKey: 'es' },
  { code: 'fr', name: 'French', flag: '🇫🇷', chipKey: 'fr' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', chipKey: 'ar' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', chipKey: 'ja' },
  { code: 'de', name: 'German', flag: '🇩🇪', chipKey: 'de' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', chipKey: 'all' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', chipKey: 'all' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', chipKey: 'all' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', chipKey: 'all' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', chipKey: 'all' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', chipKey: 'all' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', chipKey: 'all' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', chipKey: 'all' },
];

export const COUNTRY_NAME_TO_CODE: Readonly<Record<string, string>> = {
  Morocco: 'MA',
  Spain: 'ES',
  France: 'FR',
  'United Kingdom': 'GB',
  'United States': 'US',
  Japan: 'JP',
  Germany: 'DE',
  Canada: 'CA',
  Brazil: 'BR',
  'South Korea': 'KR',
  Italy: 'IT',
  Mexico: 'MX',
  Egypt: 'EG',
};

const CODE_TO_COUNTRY_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(COUNTRY_NAME_TO_CODE).map(([name, code]) => [code, name]),
);

const BY_CODE = new Map(LANGUAGE_CATALOG.map((entry) => [entry.code.toLowerCase(), entry]));
const BY_NAME = new Map(LANGUAGE_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]));

export function languageCodeFor(input: string | null | undefined): string {
  if (!input) return 'en';
  const trimmed = input.trim();
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  if (BY_CODE.has(baseCode)) {
    return baseCode;
  }
  const byName = BY_NAME.get(trimmed.toLowerCase());
  if (byName) return byName.code;
  if (/^[a-z]{2,3}(-[A-Z]{2})?$/.test(trimmed)) {
    return trimmed;
  }
  return 'en';
}

export function languageNameFor(codeOrName: string | null | undefined): string {
  if (!codeOrName) return 'English';
  const trimmed = codeOrName.trim();
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  return BY_CODE.get(baseCode)?.name ?? BY_NAME.get(trimmed.toLowerCase())?.name ?? trimmed;
}

export function languageFlagFor(codeOrName: string | null | undefined): string {
  if (!codeOrName) return '🌐';
  const trimmed = codeOrName.trim();
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  return BY_CODE.get(baseCode)?.flag ?? BY_NAME.get(trimmed.toLowerCase())?.flag ?? '🌐';
}

export function languageLabelFor(codeOrName: string | null | undefined): string {
  const flag = languageFlagFor(codeOrName);
  const name = languageNameFor(codeOrName);
  return `${flag} ${name}`;
}

export function roomFilterKeyFor(codeOrName: string | null | undefined): 'all' | 'es' | 'en' | 'fr' | 'ar' | 'ja' | 'de' {
  const code = languageCodeFor(codeOrName);
  return BY_CODE.get(code)?.chipKey ?? 'all';
}

export function countryCodeFor(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return COUNTRY_NAME_TO_CODE[trimmed] ?? null;
}

export function countryNameFor(code: string | null | undefined): string {
  if (!code) return '';
  const upper = code.trim().toUpperCase();
  return CODE_TO_COUNTRY_NAME[upper] ?? upper;
}
