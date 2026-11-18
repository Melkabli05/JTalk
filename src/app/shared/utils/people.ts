import { msg } from '@shared/utils/i18n/msg';

export type Proficiency = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'FLUENT';

export const PROFICIENCIES: readonly Proficiency[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'FLUENT',
];

export const PROFICIENCY_LABELS: Readonly<Record<Proficiency, string>> = {
  BEGINNER: msg('Beginner'),
  INTERMEDIATE: msg('Intermediate'),
  ADVANCED: msg('Advanced'),
  FLUENT: msg('Fluent'),
};

export interface LearningLanguage {
  readonly code: string;
  readonly level: Proficiency | null;
}

export interface LanguageMatrix {
  readonly native: readonly string[];
  readonly learning: readonly LearningLanguage[];
}

export interface SocialStats {
  readonly followers: number;
  readonly following: number;
  readonly followedByMe: boolean;
  readonly followsMe: boolean;
}

export type PartnerMatch =
  | { readonly kind: 'exchange'; readonly theySpeak: string; readonly theyLearn: string }
  | { readonly kind: 'teaches-you'; readonly theySpeak: string }
  | { readonly kind: 'learns-yours'; readonly theyLearn: string }
  | { readonly kind: 'none' };

export function partnerMatch(me: LanguageMatrix, them: LanguageMatrix): PartnerMatch {
  const theySpeak = them.native.find((code) => me.learning.some((entry) => entry.code === code));
  const theyLearn = them.learning
    .map((entry) => entry.code)
    .find((code) => me.native.includes(code));
  if (theySpeak !== undefined && theyLearn !== undefined) {
    return { kind: 'exchange', theySpeak, theyLearn };
  }
  if (theySpeak !== undefined) {
    return { kind: 'teaches-you', theySpeak };
  }
  if (theyLearn !== undefined) {
    return { kind: 'learns-yours', theyLearn };
  }
  return { kind: 'none' };
}

export function proficiencyShare(level: Proficiency): number {
  return ((PROFICIENCIES.indexOf(level) + 1) / PROFICIENCIES.length) * 100;
}

export function isProficiency(value: unknown): value is Proficiency {
  return PROFICIENCIES.some((level) => level === value);
}

export function flagOf(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
    : '';
}

export function countryNameOf(countryCode: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: 'region' }).of(countryCode.toUpperCase()) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

export function compactCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    count,
  );
}
