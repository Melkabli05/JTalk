/** Who a person is, as they filled it in. The backend knows users by id only; names and languages come from here. */
export interface Person {
  readonly id: string;
  readonly name: string;
  readonly nativeLanguage: string;
  readonly learning: string;
  /** The id of one of the bundled pictures (see `shared/utils/avatars`), or empty. */
  readonly avatar: string;
}

/** What a person fills in; the id is made for them. */
export type ProfileDraft = Omit<Person, 'id'>;
