import { asRecord, isStringList } from '@shared/utils/as-record';
import { msg } from '@shared/utils/i18n/msg';

/** Someone as a row in a list: enough to recognise them and open their profile. */
export interface PersonSummary {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly nativeLanguage: string;
  readonly learning: string;
  readonly avatar: string;
  readonly countryCode?: string;
}

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

/**
 * The languages a profile response carries (`nativeLanguages` and `learningLanguages`), or `undefined` when it carries none: a summary
 * in a list does not, and neither does a response from before the languages were added to the profile. A level it does not know is dropped.
 */
export function readLanguages(raw: unknown): LanguageMatrix | undefined {
  const profile = asRecord(raw);
  const learning = profile?.['learningLanguages'];
  if (
    profile === undefined ||
    !isStringList(profile['nativeLanguages']) ||
    !Array.isArray(learning)
  ) {
    return undefined;
  }
  return {
    native: profile['nativeLanguages'],
    learning: learning.flatMap((entry: unknown): LearningLanguage[] => {
      const language = asRecord(entry);
      const code = language?.['languageCode'];
      const level = language?.['proficiencyLevel'];
      return typeof code === 'string' ? [{ code, level: isProficiency(level) ? level : null }] : [];
    }),
  };
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
