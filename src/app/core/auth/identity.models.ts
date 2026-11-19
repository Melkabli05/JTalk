import type { LanguageMatrix } from '@shared/utils/people';

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly nativeLanguage: string;
  readonly learning: string;
  /** The id of one of our pictures, or the address of one they uploaded; empty when they have neither. */
  readonly avatar: string;
  /** Their handle, like `mona.k`: on a full profile, not on a summary. */
  readonly username?: string;
  readonly bio?: string;
  readonly countryCode?: string;
  /** Everything they speak and learn, with levels: on a full profile, not on a summary. `learning` is the first language they learn. */
  readonly languages?: LanguageMatrix;
}

/**
 * What the profile form hands over. `username` is present when editing and changes the handle; `upload` is a picture to send after the
 * profile is saved (the `avatar` is then what they had until it arrives).
 */
export type ProfileDraft = Omit<Person, 'id' | 'languages'> & {
  readonly upload?: Blob;
};
