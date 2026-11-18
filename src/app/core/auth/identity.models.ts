export interface Person {
  readonly id: string;
  readonly name: string;
  readonly nativeLanguage: string;
  readonly learning: string;
  readonly avatar: string;
  readonly bio?: string;
  readonly countryCode?: string;
}

export type ProfileDraft = Omit<Person, 'id'>;
