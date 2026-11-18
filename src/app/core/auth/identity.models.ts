import type { LanguageMatrix } from '@shared/utils/people';

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly nativeLanguage: string;
  readonly learning: string;
  readonly avatar: string;
  readonly bio?: string;
  readonly countryCode?: string;
  /** Everything they speak and learn, with levels: on a full profile, not on a summary. `learning` is the first language they learn. */
  readonly languages?: LanguageMatrix;
}

export type ProfileDraft = Omit<Person, 'id' | 'languages'>;
