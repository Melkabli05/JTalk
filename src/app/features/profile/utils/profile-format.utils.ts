import type { ProficiencyLevel, UserProfileResponse } from '../../../core/auth/auth.models';
import {
  COUNTRY_CATALOG,
  countryNameFor,
  LANGUAGE_CATALOG,
  languageNameFor,
} from '../../../core/utils/language-codes';

export interface ProfileLanguageRow {
  readonly code: string;
  readonly displayName: string;
  readonly nativeName: string | null;
  readonly flagCountryCode: string | null;
  readonly role: 'NATIVE' | 'LEARNING';
  readonly isPrimaryNative: boolean;
  readonly level: ProficiencyLevel | null;
}

export interface ProfileCountLabel {
  readonly formattedCount: string;
  readonly unit: string;
  readonly fullText: string;
}

const FLAG_BY_LANG = new Map(
  LANGUAGE_CATALOG.map((entry) => [entry.code.toLowerCase(), entry.flagCountryCode]),
);
const FLAG_BY_COUNTRY = new Map(COUNTRY_CATALOG.map((entry) => [entry.code, entry.flagCode]));

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function getDisplayNames(
  locale: string,
  type: 'language' | 'region',
): Intl.DisplayNames | null {
  const key = `${locale}|${type}`;
  if (displayNamesCache.has(key)) {
    return displayNamesCache.get(key) ?? null;
  }
  try {
    const formatter = new Intl.DisplayNames([locale], { type });
    displayNamesCache.set(key, formatter);
    return formatter;
  } catch {
    displayNamesCache.set(key, null);
    return null;
  }
}

export function resolveUiLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en';
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export function languageBaseCode(code: string | null | undefined): string {
  return code?.trim().split('-')[0]?.toLowerCase() ?? '';
}

export function displayLanguageName(
  code: string | null | undefined,
  locale = resolveUiLocale(),
): string {
  const trimmed = code?.trim();
  if (!trimmed) return '';
  const intl = getDisplayNames(locale, 'language');
  if (intl) {
    try {
      const formatted = intl.of(trimmed);
      if (formatted && formatted.toLowerCase() !== trimmed.toLowerCase()) {
        return formatted;
      }
    } catch {
      // Fall back to static catalog below.
    }
  }
  return languageNameFor(trimmed);
}

export function nativeLanguageName(
  code: string | null | undefined,
  uiDisplayName?: string,
): string | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  const intl = getDisplayNames(trimmed, 'language');
  if (!intl) return null;
  try {
    const formatted = intl.of(trimmed);
    if (!formatted || formatted.toLowerCase() === trimmed.toLowerCase()) return null;
    if (uiDisplayName && formatted.toLowerCase() === uiDisplayName.toLowerCase()) {
      return null;
    }
    return formatted;
  } catch {
    return null;
  }
}

export function languageFlagCodeFor(code: string | null | undefined): string | null {
  const base = languageBaseCode(code);
  return base ? (FLAG_BY_LANG.get(base) ?? null) : null;
}

export function displayCountryName(
  code: string | null | undefined,
  locale = resolveUiLocale(),
): string {
  const upper = code?.trim().toUpperCase();
  if (!upper) return '';
  const normalized = upper === 'EH' ? 'MA' : upper;
  const intl = getDisplayNames(locale, 'region');
  if (intl) {
    try {
      const formatted = intl.of(normalized);
      if (formatted && formatted !== normalized) {
        return formatted;
      }
    } catch {
      // Fall back to static catalog below.
    }
  }
  return countryNameFor(normalized);
}

export function countryFlagCodeFor(code: string | null | undefined): string | null {
  const upper = code?.trim().toUpperCase();
  if (!upper) return null;
  const normalized = upper === 'EH' ? 'MA' : upper;
  return FLAG_BY_COUNTRY.get(normalized) ?? normalized.toLowerCase();
}

export function formatJoinedMonth(
  isoDate: string | null | undefined,
  locale = resolveUiLocale(),
): string {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(parsed);
}

export function formatFollowerLabel(
  count: number,
  locale = resolveUiLocale(),
): ProfileCountLabel {
  const safe = Math.max(0, Math.floor(count));
  const formattedCount = new Intl.NumberFormat(locale).format(safe);
  const category = new Intl.PluralRules(locale).select(safe);
  const unit = category === 'one' ? 'follower' : 'followers';
  return {
    formattedCount,
    unit,
    fullText: `${formattedCount} ${unit}`,
  };
}

export function formatFollowingLabel(
  count: number,
  locale = resolveUiLocale(),
): ProfileCountLabel {
  const safe = Math.max(0, Math.floor(count));
  const formattedCount = new Intl.NumberFormat(locale).format(safe);
  const unit = 'following';
  return {
    formattedCount,
    unit,
    fullText: `${formattedCount} ${unit}`,
  };
}

export function formatProficiencyLevel(level: ProficiencyLevel | null | undefined): string {
  switch (level) {
    case 'BEGINNER':
      return 'Beginner';
    case 'INTERMEDIATE':
      return 'Intermediate';
    case 'ADVANCED':
      return 'Advanced';
    case 'FLUENT':
      return 'Fluent';
    default:
      return '';
  }
}

export function proficiencyBarsCount(level: ProficiencyLevel | null | undefined): number {
  switch (level) {
    case 'BEGINNER':
      return 1;
    case 'INTERMEDIATE':
      return 2;
    case 'ADVANCED':
      return 3;
    case 'FLUENT':
      return 4;
    default:
      return 0;
  }
}

export function buildOrderedLanguageRows(
  profile: Pick<UserProfileResponse, 'nativeLanguage' | 'nativeLanguages' | 'learningLanguages'>,
  locale = resolveUiLocale(),
): readonly ProfileLanguageRow[] {
  const rows: ProfileLanguageRow[] = [];
  const seen = new Set<string>();

  const pushNative = (code: string, isPrimary: boolean): void => {
    const trimmed = code.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    const name = displayLanguageName(trimmed, locale);
    rows.push({
      code: trimmed,
      displayName: name,
      nativeName: nativeLanguageName(trimmed, name),
      flagCountryCode: languageFlagCodeFor(trimmed),
      role: 'NATIVE',
      isPrimaryNative: isPrimary,
      level: null,
    });
  };

  if (profile.nativeLanguage) {
    pushNative(profile.nativeLanguage, true);
  }
  for (const code of profile.nativeLanguages) {
    pushNative(code, code === profile.nativeLanguage);
  }
  for (const entry of profile.learningLanguages) {
    const trimmed = entry.languageCode.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    const name = displayLanguageName(trimmed, locale);
    rows.push({
      code: trimmed,
      displayName: name,
      nativeName: nativeLanguageName(trimmed, name),
      flagCountryCode: languageFlagCodeFor(trimmed),
      role: 'LEARNING',
      isPrimaryNative: false,
      level: entry.proficiencyLevel ?? 'BEGINNER',
    });
  }

  return rows;
}

export function profileInitials(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return 'J';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = Array.from(parts[0] ?? '')[0] ?? '';
    const second = Array.from(parts[1] ?? '')[0] ?? '';
    return `${first}${second}`.toUpperCase();
  }
  return (Array.from(trimmed)[0] ?? 'J').toUpperCase();
}
