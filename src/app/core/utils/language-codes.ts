import { countries, getEmojiFlag, languages, TCountryCode, TLanguageCode } from 'countries-list';

export type RoomLangChipKey = 'all' | 'es' | 'en' | 'fr' | 'ar' | 'ja' | 'de';

export interface LanguageCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
  readonly flagCountryCode: string | null;
}

export interface CountryCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly flagCode: string;
}

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
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const LANG_BY_CODE = new Map(LANGUAGE_CATALOG.map((e) => [e.code.toLowerCase(), e]));
const COUNTRY_BY_CODE = new Map(COUNTRY_CATALOG.map((e) => [e.code, e]));

function findLanguage(code: string | null | undefined): LanguageCatalogEntry | null {
  const baseCode = code?.trim().split('-')[0]?.toLowerCase() ?? '';
  return baseCode ? (LANG_BY_CODE.get(baseCode) ?? null) : null;
}

export function languageNameFor(code: string | null | undefined): string {
  return findLanguage(code)?.name ?? (code?.trim() || 'English');
}

export function languageFlagFor(code: string | null | undefined): string {
  return findLanguage(code)?.flag ?? '🌐';
}

export function languageLabelFor(code: string | null | undefined): string {
  return `${languageFlagFor(code)} ${languageNameFor(code)}`;
}

export function countryNameFor(code: string | null | undefined): string {
  const upper = code?.trim().toUpperCase();
  if (!upper) return '';
  const normalized = upper === 'EH' ? 'MA' : upper;
  return COUNTRY_BY_CODE.get(normalized)?.name ?? normalized;
}
