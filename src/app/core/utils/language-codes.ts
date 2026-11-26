import { countries, getEmojiFlag, languages, TCountryCode, TLanguageCode } from 'countries-list';

export type RoomLangChipKey = 'all' | 'es' | 'en' | 'fr' | 'ar' | 'ja' | 'de';

export interface LanguageCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
  readonly flagCountryCode: string | null;
  readonly chipKey: RoomLangChipKey;
}

export interface CountryCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly flagCode: string;
}

const ROOM_CHIP_CODES = new Set<string>(['en', 'es', 'fr', 'ar', 'ja', 'de']);

const PRIMARY_COUNTRY_FOR_LANGUAGE: Readonly<Record<string, TCountryCode>> = {
  en: 'GB',
  es: 'ES',
  fr: 'FR',
  ar: 'SA',
  ja: 'JP',
  de: 'DE',
  pt: 'BR',
  ko: 'KR',
  zh: 'CN',
  it: 'IT',
  tr: 'TR',
  ru: 'RU',
  hi: 'IN',
  nl: 'NL',
};

const FIRST_COUNTRY_BY_LANG = new Map<string, TCountryCode>();
const countryEntries: CountryCatalogEntry[] = [];

for (const [code, data] of Object.entries(countries) as [TCountryCode, (typeof countries)[TCountryCode]][]) {
  if (code === 'EH') continue;
  countryEntries.push({ code, name: data.name, flagCode: code.toLowerCase() });
  for (const lang of data.languages) {
    if (!FIRST_COUNTRY_BY_LANG.has(lang)) FIRST_COUNTRY_BY_LANG.set(lang, code);
  }
}

export const COUNTRY_CATALOG: readonly CountryCatalogEntry[] = countryEntries.sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const LANGUAGE_CATALOG: readonly LanguageCatalogEntry[] = (
  Object.entries(languages) as [TLanguageCode, (typeof languages)[TLanguageCode]][]
)
  .map(([code, data]) => {
    const countryCode = PRIMARY_COUNTRY_FOR_LANGUAGE[code] ?? FIRST_COUNTRY_BY_LANG.get(code) ?? null;
    return {
      code,
      name: data.name,
      flag: countryCode ? getEmojiFlag(countryCode) : '🌐',
      flagCountryCode: countryCode ? countryCode.toLowerCase() : null,
      chipKey: ROOM_CHIP_CODES.has(code) ? (code as RoomLangChipKey) : 'all',
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const LANGUAGE_NAMES: readonly string[] = LANGUAGE_CATALOG.map((e) => e.name);
export const COUNTRY_NAMES: readonly string[] = COUNTRY_CATALOG.map((e) => e.name);

const LANG_BY_CODE = new Map(LANGUAGE_CATALOG.map((e) => [e.code.toLowerCase(), e]));
const LANG_BY_NAME = new Map(LANGUAGE_CATALOG.map((e) => [e.name.toLowerCase(), e]));
const COUNTRY_BY_CODE = new Map(COUNTRY_CATALOG.map((e) => [e.code, e]));
const COUNTRY_BY_NAME = new Map(COUNTRY_CATALOG.map((e) => [e.name.toLowerCase(), e]));

function findLanguage(codeOrName: string | null | undefined): LanguageCatalogEntry | null {
  const trimmed = codeOrName?.trim();
  if (!trimmed) return null;
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  return LANG_BY_CODE.get(baseCode) ?? LANG_BY_NAME.get(trimmed.toLowerCase()) ?? null;
}

export function languageCodeFor(input: string | null | undefined): string {
  const match = findLanguage(input);
  if (match) return match.code;
  const trimmed = input?.trim() ?? '';
  return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(trimmed) ? trimmed : 'en';
}

export function languageNameFor(codeOrName: string | null | undefined): string {
  return findLanguage(codeOrName)?.name ?? (codeOrName?.trim() || 'English');
}

export function languageFlagFor(codeOrName: string | null | undefined): string {
  return findLanguage(codeOrName)?.flag ?? '🌐';
}

export function languageFlagCodeFor(codeOrName: string | null | undefined): string | null {
  return findLanguage(codeOrName)?.flagCountryCode ?? null;
}

export function languageLabelFor(codeOrName: string | null | undefined): string {
  return `${languageFlagFor(codeOrName)} ${languageNameFor(codeOrName)}`;
}

export function roomFilterKeyFor(codeOrName: string | null | undefined): RoomLangChipKey {
  return findLanguage(codeOrName)?.chipKey ?? 'all';
}

export function countryCodeFor(location: string | null | undefined): string | null {
  const trimmed = location?.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === 'EH' || trimmed.toLowerCase() === 'western sahara') return 'MA';
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return COUNTRY_BY_NAME.get(trimmed.toLowerCase())?.code ?? null;
}

export function countryNameFor(code: string | null | undefined): string {
  const upper = code?.trim().toUpperCase();
  if (!upper) return '';
  const normalized = upper === 'EH' ? 'MA' : upper;
  return COUNTRY_BY_CODE.get(normalized)?.name ?? normalized;
}

export function countryFlagCodeFor(locationOrCode: string | null | undefined): string | null {
  return countryCodeFor(locationOrCode)?.toLowerCase() ?? null;
}
