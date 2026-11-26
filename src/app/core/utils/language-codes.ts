import { countries, getEmojiFlag, languages, TCountryCode, TLanguageCode } from 'countries-list';

export type RoomLangChipKey = 'all' | 'es' | 'en' | 'fr' | 'ar' | 'ja' | 'de';

export interface LanguageCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly native: string;
  readonly flag: string;
  readonly flagCountryCode: string | null;
  readonly chipKey: RoomLangChipKey;
}

export interface CountryCatalogEntry {
  readonly code: string;
  readonly name: string;
  readonly native: string;
  readonly flagCode: string;
  readonly emoji: string;
}

const CHIP_KEYS: Readonly<Record<string, RoomLangChipKey>> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  ar: 'ar',
  ja: 'ja',
  de: 'de',
};

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
for (const [countryCode, country] of Object.entries(countries) as [TCountryCode, (typeof countries)[TCountryCode]][]) {
  for (const lang of country.languages) {
    if (!FIRST_COUNTRY_BY_LANG.has(lang)) {
      FIRST_COUNTRY_BY_LANG.set(lang, countryCode);
    }
  }
}

export const LANGUAGE_CATALOG: readonly LanguageCatalogEntry[] = (
  Object.entries(languages) as [TLanguageCode, (typeof languages)[TLanguageCode]][]
)
  .map(([code, data]) => {
    const countryCode = PRIMARY_COUNTRY_FOR_LANGUAGE[code] ?? FIRST_COUNTRY_BY_LANG.get(code) ?? null;
    return {
      code,
      name: data.name,
      native: data.native,
      flag: countryCode ? getEmojiFlag(countryCode) : '🌐',
      flagCountryCode: countryCode ? countryCode.toLowerCase() : null,
      chipKey: CHIP_KEYS[code] ?? 'all',
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_CATALOG: readonly CountryCatalogEntry[] = (
  Object.entries(countries) as [TCountryCode, (typeof countries)[TCountryCode]][]
)
  .filter(([code]) => code !== 'EH')
  .map(([code, data]) => ({
    code,
    name: data.name,
    native: data.native,
    flagCode: code.toLowerCase(),
    emoji: getEmojiFlag(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const LANGUAGE_NAMES: readonly string[] = LANGUAGE_CATALOG.map((entry) => entry.name);
export const COUNTRY_NAMES: readonly string[] = COUNTRY_CATALOG.map((entry) => entry.name);

const LANG_BY_CODE = new Map(LANGUAGE_CATALOG.map((entry) => [entry.code.toLowerCase(), entry]));
const LANG_BY_NAME = new Map(LANGUAGE_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]));
const COUNTRY_BY_CODE = new Map(COUNTRY_CATALOG.map((entry) => [entry.code.toUpperCase(), entry]));
const COUNTRY_BY_NAME = new Map(COUNTRY_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]));

export function languageCodeFor(input: string | null | undefined): string {
  if (!input) return 'en';
  const trimmed = input.trim();
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  if (LANG_BY_CODE.has(baseCode)) {
    return baseCode;
  }
  const byName = LANG_BY_NAME.get(trimmed.toLowerCase());
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
  return LANG_BY_CODE.get(baseCode)?.name ?? LANG_BY_NAME.get(trimmed.toLowerCase())?.name ?? trimmed;
}

export function languageFlagFor(codeOrName: string | null | undefined): string {
  if (!codeOrName) return '🌐';
  const trimmed = codeOrName.trim();
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  return LANG_BY_CODE.get(baseCode)?.flag ?? LANG_BY_NAME.get(trimmed.toLowerCase())?.flag ?? '🌐';
}

export function languageFlagCodeFor(codeOrName: string | null | undefined): string | null {
  if (!codeOrName) return null;
  const trimmed = codeOrName.trim();
  const baseCode = trimmed.split('-')[0]?.toLowerCase() ?? '';
  return (
    LANG_BY_CODE.get(baseCode)?.flagCountryCode ??
    LANG_BY_NAME.get(trimmed.toLowerCase())?.flagCountryCode ??
    null
  );
}

export function languageLabelFor(codeOrName: string | null | undefined): string {
  const flag = languageFlagFor(codeOrName);
  const name = languageNameFor(codeOrName);
  return `${flag} ${name}`;
}

export function roomFilterKeyFor(codeOrName: string | null | undefined): RoomLangChipKey {
  const code = languageCodeFor(codeOrName);
  return LANG_BY_CODE.get(code)?.chipKey ?? 'all';
}

export function countryCodeFor(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === 'EH' || trimmed.toLowerCase() === 'western sahara') {
    return 'MA';
  }
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return COUNTRY_BY_NAME.get(trimmed.toLowerCase())?.code ?? null;
}

export function countryNameFor(code: string | null | undefined): string {
  if (!code) return '';
  const upper = code.trim().toUpperCase();
  const normalized = upper === 'EH' ? 'MA' : upper;
  return COUNTRY_BY_CODE.get(normalized)?.name ?? normalized;
}

export function countryFlagCodeFor(locationOrCode: string | null | undefined): string | null {
  const code = countryCodeFor(locationOrCode);
  return code ? code.toLowerCase() : null;
}
